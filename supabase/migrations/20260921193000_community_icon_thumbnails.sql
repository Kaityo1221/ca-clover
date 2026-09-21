alter table public.communities
  add column if not exists avatar_thumbnail_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-icon-thumbs',
  'community-icon-thumbs',
  true,
  524288,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update public.community_icon_changes
set reviewed_at = coalesce(reviewed_at, detected_at, now())
where change_type = 'initial'
  and reviewed_at is null;
