create table public.stamp_bulk_rooms(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.stamp_events(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique,
  bulk_run_key uuid not null default gen_random_uuid() unique,
  status text not null default 'open'
    check(status in ('open','processing','partial_failed','completed','closed','expired')),
  event_name text not null,
  event_location text,
  event_timezone text not null,
  frozen_participant_count integer,
  total_pair_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  last_host_seen_at timestamptz not null default now()
);

create unique index stamp_bulk_rooms_one_active_event_uq
  on public.stamp_bulk_rooms(event_id)
  where status in ('open','processing','partial_failed','completed');

create index stamp_bulk_rooms_host_idx
  on public.stamp_bulk_rooms(host_user_id,created_at desc);

alter table public.stamp_bulk_rooms enable row level security;
revoke all on public.stamp_bulk_rooms from anon,authenticated;

create table public.stamp_bulk_participants(
  room_id uuid not null references public.stamp_bulk_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  locked_at timestamptz,
  snapshot jsonb not null,
  primary key(room_id,user_id)
);

create index stamp_bulk_participants_user_idx
  on public.stamp_bulk_participants(user_id,joined_at desc);

alter table public.stamp_bulk_participants enable row level security;
revoke all on public.stamp_bulk_participants from anon,authenticated;

alter table public.stamp_bulk_pair_attempts
  add column if not exists room_id uuid references public.stamp_bulk_rooms(id) on delete cascade;

create index if not exists stamp_bulk_pair_attempts_room_idx
  on public.stamp_bulk_pair_attempts(room_id,status);

create or replace function public.stamp_bulk_prepare_internal(
  p_room_id uuid,
  p_host_user_id uuid,
  p_expected_count integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_room public.stamp_bulk_rooms%rowtype;
  v_count integer;
  v_pairs integer;
begin
  select * into v_room
  from public.stamp_bulk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null then
    raise exception '大交換ルームが見つかりません' using errcode='P0001';
  end if;
  if v_room.host_user_id<>p_host_user_id then
    raise exception '主催者だけが交換を開始できます' using errcode='42501';
  end if;
  if v_room.status<>'open' then
    raise exception 'このルームは交換開始待ちではありません' using errcode='P0001';
  end if;

  if not exists(
    select 1
    from public.stamp_events e
    where e.id=v_room.event_id
      and e.status='scheduled'
      and now()>=e.starts_at
      and now()<e.ends_at
  ) then
    raise exception 'イベント開催時間外です' using errcode='P0001';
  end if;

  select count(*) into v_count
  from public.stamp_bulk_participants
  where room_id=v_room.id;

  if v_count<2 then
    raise exception '大交換には2人以上必要です' using errcode='P0001';
  end if;
  if p_expected_count is not null and p_expected_count<>v_count then
    raise exception '参加人数が変わりました。人数を確認してもう一度開始してください' using errcode='40001';
  end if;

  v_pairs:=(v_count*(v_count-1))/2;

  update public.stamp_bulk_rooms
  set status='processing',
      started_at=now(),
      frozen_participant_count=v_count,
      total_pair_count=v_pairs,
      last_host_seen_at=now()
  where id=v_room.id;

  update public.stamp_bulk_participants
  set locked_at=coalesce(locked_at,now())
  where room_id=v_room.id;

  insert into public.stamp_bulk_pair_attempts(
    bulk_run_key,user_a_id,user_b_id,exchange_key,status,attempt_count,room_id
  )
  select
    v_room.bulk_run_key,
    p1.user_id,
    p2.user_id,
    gen_random_uuid(),
    'pending',
    0,
    v_room.id
  from public.stamp_bulk_participants p1
  join public.stamp_bulk_participants p2
    on p1.room_id=p2.room_id
   and p1.user_id::text<p2.user_id::text
  where p1.room_id=v_room.id
  on conflict(bulk_run_key,user_a_id,user_b_id) do nothing;

  return jsonb_build_object(
    'ok',true,
    'room_id',v_room.id,
    'participant_count',v_count,
    'pair_count',v_pairs,
    'status','processing'
  );
end;
$$;

revoke all on function public.stamp_bulk_prepare_internal(uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.stamp_bulk_prepare_internal(uuid,uuid,integer)
  to service_role;

create or replace function public.stamp_bulk_process_batch_internal(
  p_room_id uuid,
  p_host_user_id uuid,
  p_mode text default 'pending',
  p_limit integer default 100,
  p_retry_cutoff timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_room public.stamp_bulk_rooms%rowtype;
  v_pair record;
  v_result jsonb;
  v_processed integer:=0;
  v_completed integer;
  v_failed integer;
  v_pending integer;
  v_eligible integer;
  v_status text;
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
begin
  if p_mode not in ('pending','failed') then
    raise exception 'invalid bulk processing mode' using errcode='22023';
  end if;

  select * into v_room
  from public.stamp_bulk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null then
    raise exception '大交換ルームが見つかりません' using errcode='P0001';
  end if;
  if v_room.host_user_id<>p_host_user_id then
    raise exception '主催者だけが交換処理できます' using errcode='42501';
  end if;
  if p_mode='pending' and v_room.status<>'processing' then
    raise exception '初回交換処理の状態ではありません' using errcode='P0001';
  end if;
  if p_mode='failed' and v_room.status<>'partial_failed' then
    raise exception '再試行できる失敗ペアはありません' using errcode='P0001';
  end if;

  for v_pair in
    select a.exchange_key,a.user_a_id,a.user_b_id
    from public.stamp_bulk_pair_attempts a
    where a.room_id=v_room.id
      and (
        (p_mode='pending' and a.status='pending')
        or
        (p_mode='failed' and a.status='failed'
          and (p_retry_cutoff is null or a.last_attempt_at is null or a.last_attempt_at<p_retry_cutoff))
      )
    order by a.created_at,a.user_a_id,a.user_b_id
    limit v_limit
  loop
    v_result:=public.stamp_bulk_exchange_pair_internal(
      v_room.bulk_run_key,
      v_pair.exchange_key,
      v_pair.user_a_id,
      v_pair.user_b_id,
      'bulk',
      v_room.event_location,
      v_room.event_name,
      v_room.event_timezone
    );
    v_processed:=v_processed+1;
  end loop;

  select
    count(*) filter(where status='completed'),
    count(*) filter(where status='failed'),
    count(*) filter(where status='pending')
  into v_completed,v_failed,v_pending
  from public.stamp_bulk_pair_attempts
  where room_id=v_room.id;

  if p_mode='pending' then
    select count(*) into v_eligible
    from public.stamp_bulk_pair_attempts
    where room_id=v_room.id and status='pending';
  else
    select count(*) into v_eligible
    from public.stamp_bulk_pair_attempts
    where room_id=v_room.id
      and status='failed'
      and (p_retry_cutoff is null or last_attempt_at is null or last_attempt_at<p_retry_cutoff);
  end if;

  if v_pending=0 and v_failed=0 then
    v_status:='completed';
    update public.stamp_bulk_rooms
    set status='completed',completed_at=coalesce(completed_at,now())
    where id=v_room.id;
  elsif v_pending=0 then
    v_status:='partial_failed';
    update public.stamp_bulk_rooms
    set status='partial_failed'
    where id=v_room.id;
  else
    v_status:='processing';
  end if;

  return jsonb_build_object(
    'ok',true,
    'room_id',v_room.id,
    'status',v_status,
    'processed_this_batch',v_processed,
    'completed_pairs',v_completed,
    'failed_pairs',v_failed,
    'pending_pairs',v_pending,
    'eligible_remaining',v_eligible,
    'total_pairs',v_room.total_pair_count
  );
end;
$$;

revoke all on function public.stamp_bulk_process_batch_internal(uuid,uuid,text,integer,timestamptz)
  from public,anon,authenticated;
grant execute on function public.stamp_bulk_process_batch_internal(uuid,uuid,text,integer,timestamptz)
  to service_role;

comment on table public.stamp_bulk_rooms is
  'One live bulk-exchange room per event. Room stays until the host closes it; stale host rooms close after five minutes when observed.';
comment on table public.stamp_bulk_participants is
  'Participants are mutable while room is open and frozen when the host starts exchange.';
