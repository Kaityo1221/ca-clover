alter table public.meetups
  add column if not exists is_passcode_reward_eligible boolean;

comment on column public.meetups.is_passcode_reward_eligible is
  'Campfire Event.isPasscodeRewardEligible. NULL means unknown/not observed, not false.';
