update public.watch_terms
set
  flag_code='TITLE_STRONG',
  severity=3,
  rule_version=2,
  updated_at=now()
where enabled=true
  and lower(phrase) in (
    lower('プライベート'),
    lower('プライベート開催'),
    lower('private meetup'),
    lower('private event')
  );
