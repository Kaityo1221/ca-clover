alter table public.community_access_requests
  add column if not exists creator_username text,
  add column if not exists creator_username_matches_profile boolean,
  add column if not exists ca_level_snapshot text,
  add column if not exists ca_role_verified boolean,
  add column if not exists niantic_id_snapshot text;

alter table public.community_access_requests
  drop constraint if exists community_access_requests_ca_level_snapshot_check;

alter table public.community_access_requests
  add constraint community_access_requests_ca_level_snapshot_check
  check (ca_level_snapshot is null or ca_level_snapshot in ('1st','2nd'));

comment on column public.community_access_requests.creator_username is
  'Campfire creator username used to cross-check the claimant Niantic ID.';
comment on column public.community_access_requests.creator_username_matches_profile is
  'True when Campfire creator.username equals the claimant profile Niantic ID after normalization.';
comment on column public.community_access_requests.ca_level_snapshot is
  '1st/2nd role from the Japan CA map at claim submission.';
comment on column public.community_access_requests.ca_role_verified is
  'True only when the Japan CA map has an active 1st/2nd entry linked to the detected Community.';
comment on column public.community_access_requests.niantic_id_snapshot is
  'Claimant Niantic ID snapshot at submission for approval-time revalidation.';
