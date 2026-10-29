-- Linkora multi-user profile platform (Supabase SQL)
-- Run this script ONCE in Supabase > SQL Editor after setting up the project.
-- To promote yourself to platform admin, run the final INSERT separately after your account exists.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9-]{2,27}$'),
  display_name text not null default 'My Linkora Page',
  subtitle text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  theme jsonb not null default '{"mode":"dark","accent":"#8a7cff","accent2":"#62d9cf","background":"#0c101b","animation":"aurora","card":"glass"}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_extras (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  show_birth_date boolean not null default false,
  height_cm numeric(5,1),
  show_height boolean not null default false,
  weight_kg numeric(5,1),
  show_weight boolean not null default false,
  location text not null default '',
  show_location boolean not null default false,
  occupation text not null default '',
  show_occupation boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 70),
  url text not null check (char_length(url) <= 2000),
  icon text not null default '↗',
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists profile_links_profile_sort_idx on public.profile_links(profile_id, sort_order);

-- This directory is deliberately admin-only; regular users cannot enumerate registered emails.
create table if not exists public.user_directory (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- Membership is assigned manually by the project owner in SQL; browser users cannot grant themselves admin.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on public.platform_admins from anon, authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 140),
  message text not null check (char_length(message) between 5 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  admin_reply text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_status_created_idx on public.support_tickets(status, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create a starter profile + safe admin directory record for each signup.
create or replace function public.handle_new_linkora_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_name text;
begin
  desired_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'member'), '@', 1));
  insert into public.profiles(id, username, display_name)
  values (new.id, 'member-' || substr(new.id::text, 1, 8), left(desired_name, 80))
  on conflict (id) do nothing;
  insert into public.profile_extras(profile_id) values (new.id) on conflict (profile_id) do nothing;
  insert into public.user_directory(id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_linkora on auth.users;
create trigger on_auth_user_created_linkora after insert on auth.users
for each row execute procedure public.handle_new_linkora_user();

-- Keep admin directory email fresh on email changes.
create or replace function public.sync_linkora_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.user_directory set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_updated_linkora on auth.users;
create trigger on_auth_user_email_updated_linkora after update of email on auth.users
for each row execute procedure public.sync_linkora_user_email();

-- Safe public endpoint: only published core fields, enabled links, and extra fields explicitly opted into public display.
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
      'theme', p.theme,
      'created_at', p.created_at
    ),
    'extras', jsonb_build_object(
      'age', case when x.show_birth_date and x.birth_date is not null then extract(year from age(current_date, x.birth_date))::integer else null end,
      'height_cm', case when x.show_height then x.height_cm else null end,
      'weight_kg', case when x.show_weight then x.weight_kg else null end,
      'location', case when x.show_location then x.location else null end,
      'occupation', case when x.show_occupation then x.occupation else null end
    ),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url, 'icon', l.icon, 'sort_order', l.sort_order) order by l.sort_order, l.created_at)
      from public.profile_links l
      where l.profile_id = p.id and l.is_enabled = true
    ), '[]'::jsonb)
  )
  from public.profiles p
  left join public.profile_extras x on x.profile_id = p.id
  where lower(p.username) = lower(p_username) and p.is_published = true
  limit 1;
$$;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- RLS for every table exposed via the Data API.
alter table public.profiles enable row level security;
alter table public.profile_extras enable row level security;
alter table public.profile_links enable row level security;
alter table public.user_directory enable row level security;
alter table public.support_tickets enable row level security;
alter table public.platform_admins enable row level security;

revoke all on public.profiles, public.profile_extras, public.profile_links, public.user_directory, public.support_tickets from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_extras to authenticated;
grant select, insert, update, delete on public.profile_links to authenticated;
grant select on public.user_directory to authenticated;
grant select, insert, update on public.support_tickets to authenticated;

-- Profiles: public reads only published profiles. Account owners and platform admins may manage them.
drop policy if exists profiles_public_published_read on public.profiles;
create policy profiles_public_published_read on public.profiles for select to anon, authenticated using (is_published = true);
drop policy if exists profiles_owner_admin_read on public.profiles;
create policy profiles_owner_admin_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_admin_update on public.profiles;
create policy profiles_owner_admin_update on public.profiles for update to authenticated using (id = (select auth.uid()) or (select public.is_platform_admin())) with check (id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists profiles_owner_admin_delete on public.profiles;
create policy profiles_owner_admin_delete on public.profiles for delete to authenticated using (id = (select auth.uid()) or (select public.is_platform_admin()));

-- Optional personal data is private to the owner + platform admins; public access only uses get_public_profile().
drop policy if exists extras_owner_admin_read on public.profile_extras;
create policy extras_owner_admin_read on public.profile_extras for select to authenticated using (profile_id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_insert on public.profile_extras;
create policy extras_owner_admin_insert on public.profile_extras for insert to authenticated with check (profile_id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_update on public.profile_extras;
create policy extras_owner_admin_update on public.profile_extras for update to authenticated using (profile_id = (select auth.uid()) or (select public.is_platform_admin())) with check (profile_id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_delete on public.profile_extras;
create policy extras_owner_admin_delete on public.profile_extras for delete to authenticated using (profile_id = (select auth.uid()) or (select public.is_platform_admin()));

-- Link rows: public can only read enabled links of published pages; owner/admin controls all links for that page.
drop policy if exists links_public_enabled_published_read on public.profile_links;
create policy links_public_enabled_published_read on public.profile_links for select to anon, authenticated using (is_enabled = true and exists (select 1 from public.profiles p where p.id = profile_id and p.is_published = true));
drop policy if exists links_owner_admin_read on public.profile_links;
create policy links_owner_admin_read on public.profile_links for select to authenticated using (exists (select 1 from public.profiles p where p.id = profile_id and (p.id = (select auth.uid()) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_insert on public.profile_links;
create policy links_owner_admin_insert on public.profile_links for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = profile_id and (p.id = (select auth.uid()) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_update on public.profile_links;
create policy links_owner_admin_update on public.profile_links for update to authenticated using (exists (select 1 from public.profiles p where p.id = profile_id and (p.id = (select auth.uid()) or (select public.is_platform_admin())))) with check (exists (select 1 from public.profiles p where p.id = profile_id and (p.id = (select auth.uid()) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_delete on public.profile_links;
create policy links_owner_admin_delete on public.profile_links for delete to authenticated using (exists (select 1 from public.profiles p where p.id = profile_id and (p.id = (select auth.uid()) or (select public.is_platform_admin()))));

-- Registration email directory is visible only to platform admins.
drop policy if exists directory_admin_read on public.user_directory;
create policy directory_admin_read on public.user_directory for select to authenticated using ((select public.is_platform_admin()));

-- Support: users can create/read only their own tickets; admin can read/update all.
drop policy if exists tickets_owner_read on public.support_tickets;
create policy tickets_owner_read on public.support_tickets for select to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists tickets_owner_insert on public.support_tickets;
create policy tickets_owner_insert on public.support_tickets for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists tickets_admin_update on public.support_tickets;
create policy tickets_admin_update on public.support_tickets for update to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- Profile pictures bucket. Public profile pictures are public assets; writes are restricted to the owner's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('linkora-avatars', 'linkora-avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists linkora_avatar_public_read on storage.objects;
create policy linkora_avatar_public_read on storage.objects for select to public using (bucket_id = 'linkora-avatars');
drop policy if exists linkora_avatar_owner_insert on storage.objects;
create policy linkora_avatar_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'linkora-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_platform_admin())));
drop policy if exists linkora_avatar_owner_update on storage.objects;
create policy linkora_avatar_owner_update on storage.objects for update to authenticated using (bucket_id = 'linkora-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_platform_admin()))) with check (bucket_id = 'linkora-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_platform_admin())));
drop policy if exists linkora_avatar_owner_delete on storage.objects;
create policy linkora_avatar_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'linkora-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_platform_admin())));

-- Auto-maintain timestamps.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists extras_set_updated_at on public.profile_extras;
create trigger extras_set_updated_at before update on public.profile_extras for each row execute procedure public.set_updated_at();
drop trigger if exists tickets_set_updated_at on public.support_tickets;
create trigger tickets_set_updated_at before update on public.support_tickets for each row execute procedure public.set_updated_at();

-- After your own account signs up, run this separately once with YOUR email to grant admin dashboard access:
-- insert into public.platform_admins(user_id)
-- select id from auth.users where lower(email) = lower('YOUR-ADMIN-EMAIL@example.com')
-- on conflict (user_id) do nothing;

-- Backfill accounts that already existed before this schema was installed.
insert into public.profiles(id, username, display_name, created_at)
select u.id, 'member-' || substr(u.id::text, 1, 8), left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(u.email, 'member'), '@', 1)), 80), u.created_at
from auth.users u
on conflict (id) do nothing;
insert into public.profile_extras(profile_id)
select u.id from auth.users u
on conflict (profile_id) do nothing;
insert into public.user_directory(id, email, created_at)
select u.id, coalesce(u.email, ''), u.created_at from auth.users u
on conflict (id) do update set email = excluded.email;
