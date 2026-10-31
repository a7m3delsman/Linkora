-- Linkora admin upgrade (safe additive migration)
-- Run this ONCE in Supabase > SQL Editor. It does not delete existing users or pages.

alter table public.user_directory
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_until timestamptz;

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  subject text not null check (char_length(subject) between 2 and 160),
  message text not null check (char_length(message) between 2 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_messages_user_created_idx
  on public.admin_messages(user_id, created_at desc);

alter table public.admin_messages enable row level security;
revoke all on public.admin_messages from anon, authenticated;
grant select, insert on public.admin_messages to authenticated;

drop policy if exists admin_messages_owner_or_admin_read on public.admin_messages;
create policy admin_messages_owner_or_admin_read
  on public.admin_messages for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists admin_messages_admin_insert on public.admin_messages;
create policy admin_messages_admin_insert
  on public.admin_messages for insert to authenticated
  with check (admin_id = (select auth.uid()) and (select public.is_platform_admin()));

-- The recipient can mark only their own message as read. No direct UPDATE grant is exposed.
create or replace function public.mark_admin_message_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.admin_messages
     set read_at = coalesce(read_at, now())
   where id = p_message_id and user_id = auth.uid();
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.mark_admin_message_read(uuid) from public, anon;
grant execute on function public.mark_admin_message_read(uuid) to authenticated;

-- Used by the frontend before opening protected member tools.
create or replace function public.is_linkora_account_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select d.is_banned from public.user_directory d where d.id = (select auth.uid())
  ), false);
$$;
revoke all on function public.is_linkora_account_banned() from public, anon;
grant execute on function public.is_linkora_account_banned() to authenticated;

comment on table public.admin_messages is 'Private one-to-one messages from Linkora platform admins to members.';

-- A banned member may still hold an already-issued access token until it expires.
-- Apply this helper in RLS so a still-valid token cannot read private member data or write changes.
create or replace function public.is_linkora_account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not coalesce((
    select d.is_banned from public.user_directory d where d.id = (select auth.uid())
  ), false);
$$;
revoke all on function public.is_linkora_account_active() from public, anon;
grant execute on function public.is_linkora_account_active() to authenticated;

-- Private owner reads are disabled for banned accounts; admins retain access.
drop policy if exists profiles_owner_admin_read on public.profiles;
create policy profiles_owner_admin_read on public.profiles for select to authenticated
  using ((id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated
  with check ((id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists profiles_owner_admin_update on public.profiles;
create policy profiles_owner_admin_update on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))
  with check ((id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists profiles_owner_admin_delete on public.profiles;
create policy profiles_owner_admin_delete on public.profiles for delete to authenticated
  using ((id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists extras_owner_admin_read on public.profile_extras;
create policy extras_owner_admin_read on public.profile_extras for select to authenticated
  using ((profile_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_insert on public.profile_extras;
create policy extras_owner_admin_insert on public.profile_extras for insert to authenticated
  with check ((profile_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_update on public.profile_extras;
create policy extras_owner_admin_update on public.profile_extras for update to authenticated
  using ((profile_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))
  with check ((profile_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists extras_owner_admin_delete on public.profile_extras;
create policy extras_owner_admin_delete on public.profile_extras for delete to authenticated
  using ((profile_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

drop policy if exists links_owner_admin_read on public.profile_links;
create policy links_owner_admin_read on public.profile_links for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and
    ((p.id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_insert on public.profile_links;
create policy links_owner_admin_insert on public.profile_links for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and
    ((p.id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_update on public.profile_links;
create policy links_owner_admin_update on public.profile_links for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and
    ((p.id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and
    ((p.id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));
drop policy if exists links_owner_admin_delete on public.profile_links;
create policy links_owner_admin_delete on public.profile_links for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and
    ((p.id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()))));

drop policy if exists tickets_owner_read on public.support_tickets;
create policy tickets_owner_read on public.support_tickets for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));
drop policy if exists tickets_owner_insert on public.support_tickets;
create policy tickets_owner_insert on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_linkora_account_active()));

drop policy if exists admin_messages_owner_or_admin_read on public.admin_messages;
create policy admin_messages_owner_or_admin_read on public.admin_messages for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_linkora_account_active())) or (select public.is_platform_admin()));

create or replace function public.mark_admin_message_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if auth.uid() is null or not (select public.is_linkora_account_active()) then
    raise exception 'Active account required';
  end if;
  update public.admin_messages set read_at = coalesce(read_at, now())
   where id = p_message_id and user_id = auth.uid();
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.mark_admin_message_read(uuid) from public, anon;
grant execute on function public.mark_admin_message_read(uuid) to authenticated;

-- Block Storage writes from banned members even while an old access token remains valid.
drop policy if exists linkora_avatar_owner_insert on storage.objects;
create policy linkora_avatar_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'linkora-avatars' and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_linkora_account_active()))
    or (select public.is_platform_admin())
  ));
drop policy if exists linkora_avatar_owner_update on storage.objects;
create policy linkora_avatar_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'linkora-avatars' and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_linkora_account_active()))
    or (select public.is_platform_admin())
  ))
  with check (bucket_id = 'linkora-avatars' and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_linkora_account_active()))
    or (select public.is_platform_admin())
  ));
drop policy if exists linkora_avatar_owner_delete on storage.objects;
create policy linkora_avatar_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'linkora-avatars' and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_linkora_account_active()))
    or (select public.is_platform_admin())
  ));
