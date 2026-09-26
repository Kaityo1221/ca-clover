alter table public.meetups
  add column if not exists reward_checked_at timestamptz;

comment on column public.meetups.reward_checked_at is
  'Last time CA Clover checked Campfire Event.isPasscodeRewardEligible.';
