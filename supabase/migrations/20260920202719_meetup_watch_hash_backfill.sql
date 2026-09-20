create or replace function private.meetup_watch_structure_hash(
  p_title text,p_details text,p_starts_at timestamptz,p_ends_at timestamptz,p_location text,p_is_ca_meetup boolean,p_campfire_live_event_name text
) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
  select encode(extensions.digest(concat_ws(chr(31),
    replace(coalesce(p_title,'∅'),chr(31),' '),
    replace(coalesce(p_details,'∅'),chr(31),' '),
    coalesce(to_char(p_starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'∅'),
    coalesce(to_char(p_ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'∅'),
    replace(coalesce(p_location,'∅'),chr(31),' '),
    case when p_is_ca_meetup is null then '∅' when p_is_ca_meetup then 'true' else 'false' end,
    replace(coalesce(p_campfire_live_event_name,'∅'),chr(31),' ')
  )::text,'sha256'),'hex');
$$;
create or replace function private.meetup_watch_activity_hash(
  p_rsvp_count integer,p_checkin_count integer
) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
  select encode(extensions.digest(concat_ws(chr(31),coalesce(p_rsvp_count::text,'∅'),coalesce(p_checkin_count::text,'∅'))::text,'sha256'),'hex');
$$;
update public.meetups
set structure_hash=private.meetup_watch_structure_hash(title,details,starts_at,ends_at,location,is_ca_meetup,campfire_live_event_name),
    activity_hash=private.meetup_watch_activity_hash(rsvp_count,checkin_count)
where structure_hash is null or activity_hash is null;
