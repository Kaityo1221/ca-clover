
-- Re-score Phase 1 findings under the finalized Meetup Watch v1.0 weights.
update public.meetup_watch_findings
set score_weight=case flag_code
  when 'TIME_SHORT' then 1
  when 'TIME_VERY_SHORT' then 2
  when 'CREATED_LAST_MINUTE' then 1
  when 'OFFICIAL_TIME_OUTSIDE' then 2
  when 'REPEAT_CLOSE' then 2
  when 'REPEAT_SAME_DAY' then 2
  when 'TITLE_CAUTION' then 2
  when 'TITLE_STRONG' then 3
  when 'PARTICIPATION_RESTRICTED' then 3
  when 'FREE_CHECKIN_TEXT' then 2
  when 'CHECKIN_ONLY' then 2
  when 'HOST_ABSENT_TEXT' then 3
  when 'NON_FACE_TO_FACE' then 3
  when 'REWARD_ONLY' then 3
  when 'LOW_CHECKIN' then 1
  when 'LOW_CHECKIN_REPEAT' then 2
  else 0
end
where active;

with per_signal as (
  select
    case_id,
    case when flag_code in ('TIME_SHORT','TIME_VERY_SHORT') then 'TIME' else flag_code end as signal_key,
    max(score_weight) as signal_score
  from public.meetup_watch_findings
  where active
  group by case_id,
           case when flag_code in ('TIME_SHORT','TIME_VERY_SHORT') then 'TIME' else flag_code end
),
scores as (
  select case_id,coalesce(sum(signal_score),0)::integer as score
  from per_signal
  group by case_id
),
flags as (
  select
    case_id,
    array_agg(distinct flag_code order by flag_code) as flags,
    bool_or(flag_code in (
      'TITLE_STRONG',
      'PARTICIPATION_RESTRICTED',
      'HOST_ABSENT_TEXT',
      'NON_FACE_TO_FACE',
      'REWARD_ONLY'
    )) as strong_standalone
  from public.meetup_watch_findings
  where active
  group by case_id
)
update public.meetup_watch_cases c
set
  score=coalesce(s.score,0),
  priority=least(5,coalesce(s.score,0)),
  priority_level=case
    when coalesce(s.score,0)>=5 then 'high'
    when coalesce(s.score,0)>=3 then 'review'
    else 'record'
  end,
  review_required=coalesce(s.score,0)>=3,
  high_priority=coalesce(s.score,0)>=5,
  discord_candidate=(coalesce(s.score,0)>=5 or coalesce(f.strong_standalone,false)),
  flags=coalesce(f.flags,'{}'::text[]),
  updated_at=now()
from scores s
left join flags f on f.case_id=s.case_id
where c.id=s.case_id;

update public.meetup_watch_cases c
set
  score=0,
  priority=0,
  priority_level='record',
  review_required=false,
  high_priority=false,
  discord_candidate=false,
  flags='{}'::text[],
  updated_at=now()
where not exists (
  select 1
  from public.meetup_watch_findings f
  where f.case_id=c.id and f.active
);
