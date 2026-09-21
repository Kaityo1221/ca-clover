insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'community-icon-archive',
  'community-icon-archive',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table public.community_icon_versions(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  content_hash text not null,
  source_avatar_url text,
  archive_path text,
  thumbnail_path text,
  detection_method text not null
    check (detection_method in ('content_sha256','url_fallback')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique(community_id,content_hash)
);

create index community_icon_versions_community_idx
  on public.community_icon_versions(community_id,first_seen_at desc);

create unique index community_icon_versions_one_current_uq
  on public.community_icon_versions(community_id)
  where is_current;

alter table public.community_icon_versions enable row level security;

create policy "community icon versions admin read"
on public.community_icon_versions
for select
to authenticated
using(private.is_admin());

revoke all on public.community_icon_versions from anon,authenticated;
grant select on public.community_icon_versions to authenticated;

create policy "community icon archive public read"
on storage.objects
for select
to public
using(bucket_id='community-icon-archive');

comment on table public.community_icon_versions is
  'Permanent Community icon versions. Raw image and versioned thumbnail remain available even after Campfire URLs change.';
