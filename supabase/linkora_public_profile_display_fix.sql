-- Linkora public profile display fix. Safe to re-run.
-- Run this in Supabase SQL Editor AFTER linkora_features_upgrade.sql.
-- It updates the public read function and safely adds any missing display columns.
-- It does not change profile content or delete user data.

alter table public.profile_links
  add column if not exists is_featured boolean not null default false,
  add column if not exists show_as_card boolean not null default true,
  add column if not exists show_as_icon boolean not null default false;

alter table public.profile_memberships
  add column if not exists show_membership_badge boolean not null default true,
  add column if not exists show_verified_badge boolean not null default true;

grant select, insert, update on table public.profile_memberships to service_role;

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
        'id', l.id,
        'label', l.label,
        'url', l.url,
        'icon', l.icon,
        'sort_order', l.sort_order,
        'is_featured', coalesce(l.is_featured, false),
        'show_as_card', coalesce(l.show_as_card, true),
        'show_as_icon', coalesce(l.show_as_icon, false)
      ) order by l.sort_order, l.created_at)
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
