
update public.meetups
set structure_hash=private.meetup_watch_structure_hash(
  title,details,starts_at,ends_at,location,is_ca_meetup,campfire_live_event_name
)
where structure_hash is null;
