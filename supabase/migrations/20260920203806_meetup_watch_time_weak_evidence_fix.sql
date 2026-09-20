update public.meetup_watch_cases
set
  review_required=false,
  priority=1,
  updated_at=now()
where review_required=true
  and flags <@ array['TIME_SHORT','TIME_VERY_SHORT']::text[]
  and 'TIME_VERY_SHORT'=any(flags);
