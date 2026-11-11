-- Linkora account pages, plan quotas, and maintenance mode.
-- Run this AFTER schema.sql, upgrade_admin.sql, linkora_features_upgrade.sql,
-- and linkora_display_controls_upgrade.sql. Safe to re-run.

begin;

-- Keep current profile IDs intact: for legacy users their first profile id is still auth.users.id.
-- New profiles receive independent UUIDs and are associated by owner_id.
alter table public.profiles
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
update public.profiles set owner_id = id where owner_id is null;
alter table public.profiles alter column owner_id set not null;
-- The legacy profile ID used to be the Auth user ID. New pages need independent IDs,
-- so remove only the old profiles.id -> auth.users.id foreign key; owner_id now owns the cascade.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute where attrelid='public.profiles'::regclass and attname='id')]
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles alter column id set default gen_random_uuid();
create index if not exists profiles_owner_created_idx on public.profiles(owner_id, created_at);

-- Membership is an account-level entitlement, not a page-level entitlement.
-- Existing membership profile_id values already equal the owning auth user IDs.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profile_memberships'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute where attrelid='public.profile_memberships'::regclass and attname='profile_id')]
  loop
    execute format('alter table public.profile_memberships drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profile_memberships
  add constraint profile_memberships_account_user_fkey
  foreign key (profile_id) references auth.users(id) on delete cascade;

-- Signup still creates the first page, now with its account owner set explicitly.
create or replace function public.handle_new_linkora_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare desired_name text;
begin
  desired_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'member'), '@', 1));
  insert into public.profiles(id, owner_id, username, display_name)
  values (new.id, new.id, 'member-' || substr(new.id::text, 1, 8), left(desired_name, 80))
  on conflict (id) do update set owner_id = coalesce(public.profiles.owner_id, excluded.owner_id);
  insert into public.profile_extras(profile_id) values (new.id) on conflict (profile_id) do nothing;
  insert into public.user_directory(id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Account-level page quota: Free=1, Pro=5, VIP=unlimited.
create or replace function public.linkora_effective_tier(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when m.expires_at is not null and m.expires_at <= now() then 'free'
    else coalesce(m.tier, 'free')
  end
  from (select p_user_id as user_id) u
  left join public.profile_memberships m on m.profile_id = u.user_id;
$$;
revoke all on function public.linkora_effective_tier(uuid) from public, anon;
revoke all on function public.linkora_effective_tier(uuid) from public, anon, authenticated;

create or replace function public.enforce_linkora_page_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_count integer;
  v_tier text;
  v_limit integer;
begin
  v_owner := coalesce(new.owner_id, (select auth.uid()));
  if v_owner is null then raise exception 'Page owner is required.'; end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id and not (select public.is_platform_admin()) then
      raise exception 'Changing a page owner is not allowed.';
    end if;
    return new;
  end if;
  -- Signup triggers and trusted service-role operations run without an end-user JWT.
  -- Ordinary browser inserts are still constrained by RLS and the quota below.
  if (select auth.uid()) is null then
    new.owner_id := v_owner;
    return new;
  end if;
  if (select public.is_platform_admin()) then
    new.owner_id := v_owner;
    return new;
  end if;
  if v_owner <> (select auth.uid()) or not (select public.is_linkora_account_active()) then
    raise exception 'Active page owner required.';
  end if;

  -- Serialize concurrent page creation attempts for the same account.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));
  v_tier := public.linkora_effective_tier(v_owner);
  v_limit := case v_tier when 'pro' then 5 when 'vip' then null else 1 end;
  if v_limit is not null then
    select count(*) into v_count from public.profiles p where p.owner_id = v_owner;
    if v_count >= v_limit then
      raise exception 'PAGE_LIMIT_REACHED:%:%', v_tier, v_limit using errcode = 'P0001';
    end if;
  end if;
  new.owner_id := v_owner;
  return new;
end;
$$;
drop trigger if exists profiles_enforce_page_quota on public.profiles;
create trigger profiles_enforce_page_quota
before insert or update of owner_id on public.profiles
for each row execute function public.enforce_linkora_page_quota();

create or replace function public.prevent_last_linkora_page_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  -- Auth-user deletion cascades through owner_id with no browser JWT.
  if (select auth.uid()) is null then return old; end if;
  if (select public.is_platform_admin()) then return old; end if;
  if old.owner_id <> (select auth.uid()) or not (select public.is_linkora_account_active()) then
    raise exception 'Active page owner required.';
  end if;
  select count(*) into v_count from public.profiles p where p.owner_id = old.owner_id;
  if v_count <= 1 then raise exception 'You must keep at least one Linkora page.'; end if;
  return old;
end;
$$;
drop trigger if exists profiles_prevent_last_page_delete on public.profiles;
create trigger profiles_prevent_last_page_delete
before delete on public.profiles
for each row execute function public.prevent_last_linkora_page_delete();

-- The editor uses this RPC for transactional page creation and quota display.
create or replace function public.get_my_linkora_page_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tier text; v_count integer; v_limit integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_tier := public.linkora_effective_tier(auth.uid());
  v_limit := case v_tier when 'pro' then 5 when 'vip' then null else 1 end;
  select count(*) into v_count from public.profiles p where p.owner_id = auth.uid();
  return jsonb_build_object('tier', v_tier, 'pages', v_count, 'limit', v_limit,
    'can_add', v_limit is null or v_count < v_limit);
end;
$$;
revoke all on function public.get_my_linkora_page_quota() from public, anon;
grant execute on function public.get_my_linkora_page_quota() to authenticated;

create or replace function public.create_linkora_page(p_display_name text default 'صفحة جديدة')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_profile public.profiles%rowtype; v_name text;
begin
  v_user := auth.uid();
  if v_user is null or not (select public.is_linkora_account_active()) then raise exception 'Active account required'; end if;
  v_name := left(coalesce(nullif(trim(p_display_name), ''), 'صفحة جديدة'), 80);
  insert into public.profiles(owner_id, username, display_name, subtitle, bio, avatar_url, cover_url, theme, is_published)
  values (v_user, 'page-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), v_name, '', '', '', '',
    '{"mode":"dark","accent":"#8a7cff","accent2":"#62d9cf","background":"#0c101b","animation":"aurora","card":"glass","linkCardStyle":"glass","linkAnimation":"lift","cardLanguage":"ar"}'::jsonb,
    false)
  returning * into v_profile;
  insert into public.profile_extras(profile_id) values (v_profile.id) on conflict (profile_id) do nothing;
  return jsonb_build_object('id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name);
end;
$$;
revoke all on function public.create_linkora_page(text) from public, anon;
grant execute on function public.create_linkora_page(text) to authenticated;

-- Site maintenance settings; public status is exposed through a safe RPC only.
create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'الموقع في حالة صيانة حاليًا. سنعود للعمل قريبًا.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_settings(id) values (true) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update on public.site_settings to service_role;

create or replace function public.get_linkora_site_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'maintenance_mode', coalesce(s.maintenance_mode, false),
    'message', coalesce(s.maintenance_message, 'الموقع في حالة صيانة حاليًا. سنعود للعمل قريبًا.')
  )
  from (select 1) seed
  left join public.site_settings s on s.id = true;
$$;
revoke all on function public.get_linkora_site_status() from public;
grant execute on function public.get_linkora_site_status() to anon, authenticated;

-- Prevent direct table/API reads of published profiles from bypassing maintenance mode.
-- The helper is safe to call from RLS and returns only a boolean.
create or replace function public.linkora_public_profiles_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not coalesce((select s.maintenance_mode from public.site_settings s where s.id = true), false)
    or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.linkora_public_profiles_access() from public;
grant execute on function public.linkora_public_profiles_access() to anon, authenticated;

-- All profile ownership checks now use owner_id rather than assuming one profile per auth user.
drop policy if exists profiles_public_published_read on public.profiles;
create policy profiles_public_published_read on public.profiles for select to anon, authenticated
  using (is_published = true and (select public.linkora_public_profiles_access()));
drop policy if exists profiles_owner_admin_read on public.profiles;
create policy profiles_owner_admin_read on public.profiles for select to authenticated
  using ((owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated
  with check ((owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_admin_update on public.profiles;
create policy profiles_owner_admin_update on public.profiles for update to authenticated
  using ((owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))
  with check ((owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_admin_delete on public.profiles;
create policy profiles_owner_admin_delete on public.profiles for delete to authenticated
  using ((owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists extras_owner_admin_read on public.profile_extras;
create policy extras_owner_admin_read on public.profile_extras for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists extras_owner_admin_insert on public.profile_extras;
create policy extras_owner_admin_insert on public.profile_extras for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists extras_owner_admin_update on public.profile_extras;
create policy extras_owner_admin_update on public.profile_extras for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists extras_owner_admin_delete on public.profile_extras;
create policy extras_owner_admin_delete on public.profile_extras for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));

drop policy if exists links_owner_admin_read on public.profile_links;
create policy links_owner_admin_read on public.profile_links for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_insert on public.profile_links;
create policy links_owner_admin_insert on public.profile_links for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_update on public.profile_links;
create policy links_owner_admin_update on public.profile_links for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_delete on public.profile_links;
create policy links_owner_admin_delete on public.profile_links for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and ((p.owner_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));

-- Updated public profile endpoint: membership follows the account owner and respects maintenance mode.
create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name,
      'subtitle', p.subtitle, 'bio', p.bio, 'avatar_url', p.avatar_url,
      'cover_url', p.cover_url, 'theme', p.theme, 'created_at', p.created_at
    ),
    'membership', jsonb_build_object(
      'tier', case when m.expires_at is not null and m.expires_at <= now() then 'free' else coalesce(m.tier, 'free') end,
      'is_verified', coalesce(m.is_verified, false),
      'show_membership_badge', coalesce(m.show_membership_badge, true),
      'show_verified_badge', coalesce(m.show_verified_badge, true),
      'expires_at', m.expires_at
    ),
    'extras', jsonb_build_object(
      'age', case when x.show_birth_date and x.birth_date is not null then extract(year from age(current_date, x.birth_date))::integer else null end,
      'height_cm', case when x.show_height then x.height_cm else null end,
      'weight_kg', case when x.show_weight then x.weight_kg else null end,
      'location', case when x.show_location then x.location else null end,
      'occupation', case when x.show_occupation then x.occupation else null end
    ),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'label', l.label, 'url', l.url, 'icon', l.icon,
        'sort_order', l.sort_order, 'is_featured', l.is_featured,
        'show_as_card', coalesce(l.show_as_card, true),
        'show_as_icon', coalesce(l.show_as_icon, false)
      ) order by l.sort_order, l.created_at)
      from public.profile_links l
      where l.profile_id = p.id and l.is_enabled = true
    ), '[]'::jsonb)
  )
  from public.profiles p
  left join public.profile_extras x on x.profile_id = p.id
  left join public.profile_memberships m on m.profile_id = p.owner_id
  left join public.site_settings s on s.id = true
  where lower(p.username) = lower(p_username) and p.is_published = true
    and (not coalesce(s.maintenance_mode, false) or (select public.is_platform_admin()))
  limit 1;
$$;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- Analytics are now attached to the selected page, not the account's legacy profile UUID.
drop function if exists public.get_profile_analytics(integer);
create or replace function public.get_profile_analytics(p_days integer default 30, p_profile_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days,30), 90));
  v_profile_id uuid;
  v_total_views bigint;
  v_total_clicks bigint;
  v_daily jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_profile_id is null then
    select p.id into v_profile_id from public.profiles p
    where p.owner_id = auth.uid() order by p.created_at asc limit 1;
  else
    select p.id into v_profile_id from public.profiles p
    where p.id = p_profile_id and (p.owner_id = auth.uid() or (select public.is_platform_admin()));
  end if;
  if v_profile_id is null then raise exception 'Profile not found or access denied'; end if;

  select count(*) filter (where e.event_type='view'), count(*) filter (where e.event_type='click')
    into v_total_views, v_total_clicks
    from public.profile_events e
    where e.profile_id = v_profile_id and e.created_at >= now() - make_interval(days => v_days);
  select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'views', coalesce(a.views,0), 'clicks', coalesce(a.clicks,0)) order by d.day), '[]'::jsonb)
    into v_daily
    from generate_series(current_date - (v_days - 1), current_date, interval '1 day') d(day)
    left join (
      select e.created_at::date as day,
        count(*) filter (where e.event_type='view') as views,
        count(*) filter (where e.event_type='click') as clicks
      from public.profile_events e
      where e.profile_id = v_profile_id and e.created_at >= now() - make_interval(days => v_days)
      group by e.created_at::date
    ) a on a.day = d.day::date;
  return jsonb_build_object('days',v_days,'views',coalesce(v_total_views,0),'clicks',coalesce(v_total_clicks,0),'daily',v_daily);
end;
$$;
revoke all on function public.get_profile_analytics(integer, uuid) from public;
grant execute on function public.get_profile_analytics(integer, uuid) to authenticated;

commit;
