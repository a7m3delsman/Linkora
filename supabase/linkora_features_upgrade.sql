-- Linkora memberships, badges, cover images, and privacy-safe analytics.
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.

alter table public.profiles
  add column if not exists cover_url text not null default '';

alter table public.profile_links
  add column if not exists is_featured boolean not null default false;

create table if not exists public.profile_memberships (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro','vip')),
  is_verified boolean not null default false,
  expires_at timestamptz,
  admin_note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists profile_memberships_tier_idx on public.profile_memberships(tier);
alter table public.profile_memberships enable row level security;
revoke all on public.profile_memberships from anon, authenticated;
grant select on public.profile_memberships to authenticated;
drop policy if exists profile_memberships_admin_read on public.profile_memberships;
create policy profile_memberships_admin_read on public.profile_memberships
  for select to authenticated using ((select public.is_platform_admin()));

-- Give existing platform administrators the requested VIP identity badge by default.
insert into public.profile_memberships(profile_id, tier, is_verified, admin_note)
select a.user_id, 'vip', true, 'Platform administrator default VIP badge'
from public.platform_admins a
on conflict (profile_id) do nothing;

create or replace function public.assign_vip_to_new_platform_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile_memberships(profile_id, tier, is_verified, admin_note)
  values (new.user_id, 'vip', true, 'Platform administrator default VIP badge')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;
drop trigger if exists platform_admin_default_vip on public.platform_admins;
create trigger platform_admin_default_vip after insert on public.platform_admins
for each row execute procedure public.assign_vip_to_new_platform_admin();

-- A missing membership row is always Free. Browser users cannot edit membership rows;
-- only the linkora-admin Edge Function uses the service-role key to write them.

create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', p.display_name,
      'subtitle', p.subtitle,
      'bio', p.bio,
      'avatar_url', p.avatar_url,
      'cover_url', p.cover_url,
      'theme', p.theme,
      'created_at', p.created_at
    ),
    'membership', jsonb_build_object(
      'tier', case when m.expires_at is not null and m.expires_at <= now() then 'free' else coalesce(m.tier, 'free') end,
      'is_verified', coalesce(m.is_verified, false),
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
      select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url, 'icon', l.icon, 'sort_order', l.sort_order, 'is_featured', l.is_featured) order by l.sort_order, l.created_at)
      from public.profile_links l
      where l.profile_id = p.id and l.is_enabled = true
    ), '[]'::jsonb)
  )
  from public.profiles p
  left join public.profile_extras x on x.profile_id = p.id
  left join public.profile_memberships m on m.profile_id = p.id
  where lower(p.username) = lower(p_username) and p.is_published = true
  limit 1;
$$;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- Anonymous view/click events. No direct table reads are exposed to visitors.
create table if not exists public.profile_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  link_id uuid references public.profile_links(id) on delete set null,
  event_type text not null check (event_type in ('view','click')),
  created_at timestamptz not null default now()
);
create index if not exists profile_events_profile_date_idx on public.profile_events(profile_id, created_at desc);
alter table public.profile_events enable row level security;
revoke all on public.profile_events from anon, authenticated;

create or replace function public.log_profile_event(p_username text, p_event text, p_link_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if p_event not in ('view','click') then return false; end if;
  select p.id into v_profile_id from public.profiles p
    where lower(p.username) = lower(p_username) and p.is_published = true limit 1;
  if v_profile_id is null then return false; end if;
  if p_event = 'click' then
    if p_link_id is null or not exists (
      select 1 from public.profile_links l where l.id = p_link_id and l.profile_id = v_profile_id and l.is_enabled = true
    ) then return false; end if;
  else
    p_link_id := null;
  end if;
  insert into public.profile_events(profile_id, link_id, event_type) values (v_profile_id, p_link_id, p_event);
  return true;
end;
$$;
revoke all on function public.log_profile_event(text,text,uuid) from public;
grant execute on function public.log_profile_event(text,text,uuid) to anon, authenticated;

create or replace function public.get_profile_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days,30), 90));
  v_total_views bigint;
  v_total_clicks bigint;
  v_daily jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'Profile not found';
  end if;
  select count(*) filter (where e.event_type='view'), count(*) filter (where e.event_type='click')
    into v_total_views, v_total_clicks
    from public.profile_events e
    where e.profile_id = auth.uid() and e.created_at >= now() - make_interval(days => v_days);
  select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'views', coalesce(a.views,0), 'clicks', coalesce(a.clicks,0)) order by d.day), '[]'::jsonb)
    into v_daily
    from generate_series(current_date - (v_days - 1), current_date, interval '1 day') d(day)
    left join (
      select e.created_at::date as day,
        count(*) filter (where e.event_type='view') as views,
        count(*) filter (where e.event_type='click') as clicks
      from public.profile_events e
      where e.profile_id = auth.uid() and e.created_at >= now() - make_interval(days => v_days)
      group by e.created_at::date
    ) a on a.day = d.day::date;
  return jsonb_build_object('days',v_days,'views',coalesce(v_total_views,0),'clicks',coalesce(v_total_clicks,0),'daily',v_daily);
end;
$$;
revoke all on function public.get_profile_analytics(integer) from public;
grant execute on function public.get_profile_analytics(integer) to authenticated;

-- Optional migration backfill: every existing profile implicitly starts on Free.
-- Rows are intentionally not inserted; NULL membership is interpreted as Free.
