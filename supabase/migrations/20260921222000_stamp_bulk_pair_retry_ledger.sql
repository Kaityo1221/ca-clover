
create table public.stamp_bulk_pair_attempts(
  bulk_run_key uuid not null,
  user_a_id uuid not null references public.profiles(id) on delete restrict,
  user_b_id uuid not null references public.profiles(id) on delete restrict,
  exchange_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending','completed','failed')),
  attempt_count integer not null default 0 check (attempt_count>=0),
  result jsonb,
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(bulk_run_key,user_a_id,user_b_id),
  unique(exchange_key),
  check(user_a_id<>user_b_id)
);

create index stamp_bulk_pair_attempts_status_idx
  on public.stamp_bulk_pair_attempts(bulk_run_key,status);

alter table public.stamp_bulk_pair_attempts enable row level security;
revoke all on public.stamp_bulk_pair_attempts from anon,authenticated;

comment on table public.stamp_bulk_pair_attempts is
  'Pair-level result ledger for future bulk exchange. Failed pairs can be retried independently without replaying completed pairs.';

create or replace function public.stamp_bulk_exchange_pair_internal(
  p_bulk_run_key uuid,
  p_exchange_key uuid,
  p_user_a_id uuid,
  p_user_b_id uuid,
  p_source text default 'bulk',
  p_location text default null,
  p_event_name text default null,
  p_timezone text default 'Asia/Tokyo'
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_a uuid;
  v_b uuid;
  v_existing public.stamp_bulk_pair_attempts%rowtype;
  v_result jsonb;
  v_error text;
begin
  if p_bulk_run_key is null or p_exchange_key is null
     or p_user_a_id is null or p_user_b_id is null
     or p_user_a_id=p_user_b_id then
    raise exception 'invalid bulk pair request' using errcode='22023';
  end if;

  if p_user_a_id::text < p_user_b_id::text then
    v_a:=p_user_a_id; v_b:=p_user_b_id;
  else
    v_a:=p_user_b_id; v_b:=p_user_a_id;
  end if;

  select * into v_existing
  from public.stamp_bulk_pair_attempts
  where bulk_run_key=p_bulk_run_key
    and user_a_id=v_a
    and user_b_id=v_b
  for update;

  if v_existing.status='completed' and v_existing.result is not null then
    return v_existing.result || jsonb_build_object(
      'bulk_run_key',p_bulk_run_key,
      'pair_status','completed',
      'pair_replay',true
    );
  end if;

  insert into public.stamp_bulk_pair_attempts(
    bulk_run_key,user_a_id,user_b_id,exchange_key,status,attempt_count,last_attempt_at
  )
  values(
    p_bulk_run_key,v_a,v_b,p_exchange_key,'pending',1,now()
  )
  on conflict(bulk_run_key,user_a_id,user_b_id)
  do update set
    attempt_count=public.stamp_bulk_pair_attempts.attempt_count+1,
    last_attempt_at=now(),
    last_error=null
  returning * into v_existing;

  begin
    v_result:=public.stamp_exchange_pair_internal(
      v_existing.exchange_key,
      p_user_a_id,
      p_user_b_id,
      p_source,
      p_location,
      p_event_name,
      p_timezone
    );

    update public.stamp_bulk_pair_attempts
    set status='completed',
        result=v_result,
        last_error=null,
        completed_at=now()
    where bulk_run_key=p_bulk_run_key
      and user_a_id=v_a
      and user_b_id=v_b;

    return v_result || jsonb_build_object(
      'bulk_run_key',p_bulk_run_key,
      'pair_status','completed',
      'pair_replay',false
    );
  exception when others then
    v_error:=sqlerrm;
    update public.stamp_bulk_pair_attempts
    set status='failed',
        last_error=v_error,
        result=null
    where bulk_run_key=p_bulk_run_key
      and user_a_id=v_a
      and user_b_id=v_b;

    return jsonb_build_object(
      'ok',false,
      'bulk_run_key',p_bulk_run_key,
      'pair_status','failed',
      'exchange_key',v_existing.exchange_key,
      'error',v_error
    );
  end;
end;
$$;

revoke all on function public.stamp_bulk_exchange_pair_internal(uuid,uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stamp_bulk_exchange_pair_internal(uuid,uuid,uuid,uuid,text,text,text,text)
  to service_role;

comment on function public.stamp_bulk_exchange_pair_internal(uuid,uuid,uuid,uuid,text,text,text,text) is
  'Service-only pair wrapper for bulk exchange. Completed pairs are never replayed; failed pairs can be retried independently.';
