-- Backfill the current archived Community icon into the design-history table.
-- This makes already-acquired stamps use the same stable Supabase thumbnail
-- for 3D medal textures instead of falling back to the live Community avatar URL.
insert into public.community_icon_versions(
  community_id,
  content_hash,
  source_avatar_url,
  archive_path,
  thumbnail_path,
  detection_method,
  first_seen_at,
  last_seen_at,
  is_current
)
select
  c.id,
  c.avatar_content_hash,
  c.avatar_url,
  null,
  c.avatar_thumbnail_path,
  'content_sha256',
  coalesce(c.avatar_last_changed_at,c.created_at,now()),
  now(),
  true
from public.communities c
where c.avatar_thumbnail_path is not null
  and c.avatar_content_hash is not null
  and not exists(
    select 1
    from public.community_icon_versions v
    where v.community_id=c.id
      and v.is_current
  )
on conflict (community_id,content_hash) do update
set source_avatar_url=excluded.source_avatar_url,
    thumbnail_path=excluded.thumbnail_path,
    last_seen_at=excluded.last_seen_at,
    is_current=true;
