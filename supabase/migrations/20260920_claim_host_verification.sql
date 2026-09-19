alter table public.community_access_requests
  add column if not exists creator_display_name text,
  add column if not exists creator_ca_badge_verified boolean,
  add column if not exists ca_map_status text;

alter table public.community_access_requests
  drop constraint if exists community_access_requests_ca_map_status_check;

alter table public.community_access_requests
  add constraint community_access_requests_ca_map_status_check
  check (
    ca_map_status is null or
    ca_map_status in ('matched','not_listed','community_mismatch','identity_missing')
  );

comment on column public.community_access_requests.creator_display_name is
  'Public Campfire display name of the Meetup creator. Campfire internal user ID is intentionally not stored.';

comment on column public.community_access_requests.creator_ca_badge_verified is
  'True when the Meetup creator exposes the PGO_COMMUNITY_AMBASSADOR badge.';

comment on column public.community_access_requests.ca_map_status is
  'Cross-check status against the external Japan CA map; does not determine 1st/2nd by registration order.';
