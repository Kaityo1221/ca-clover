alter table public.community_access_requests
  add column if not exists request_source text not null default 'meetup_share',
  add column if not exists input_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='community_access_requests_request_source_check'
  ) then
    alter table public.community_access_requests
      add constraint community_access_requests_request_source_check
      check (request_source in ('meetup_share','community_invite'));
  end if;
end $$;

alter table public.community_access_requests
  alter column campfire_meetup_id drop not null,
  alter column meetup_url drop not null,
  alter column meetup_title drop not null;

comment on column public.community_access_requests.request_source is
  'How the user identified the Community: meetup_share or community_invite.';
comment on column public.community_access_requests.input_url is
  'Original Campfire share URL supplied by the user.';
