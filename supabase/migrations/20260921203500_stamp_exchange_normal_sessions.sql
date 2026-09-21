create table public.stamp_exchange_sessions(
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  issuer_user_id uuid not null references public.profiles(id) on delete cascade,
  scanner_user_id uuid references public.profiles(id) on delete cascade,
  exchange_key uuid not null unique default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open','paired','completed','cancelled','expired')),
  issuer_confirmed boolean not null default false,
  scanner_confirmed boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paired_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  check (scanner_user_id is null or scanner_user_id<>issuer_user_id)
);

create index stamp_exchange_sessions_issuer_idx
  on public.stamp_exchange_sessions(issuer_user_id,created_at desc);
create index stamp_exchange_sessions_scanner_idx
  on public.stamp_exchange_sessions(scanner_user_id,created_at desc);
create index stamp_exchange_sessions_status_idx
  on public.stamp_exchange_sessions(status,expires_at);

alter table public.stamp_exchange_sessions enable row level security;
revoke all on public.stamp_exchange_sessions from anon,authenticated;

comment on table public.stamp_exchange_sessions is
  'Short-lived normal 1:1 Stamp Rally exchange sessions. QR secrets are stored only as SHA-256 hashes.';

create or replace function public.stamp_exchange_claim_internal(
  p_token_hash text,
  p_scanner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.stamp_exchange_sessions%rowtype;
begin
  if p_token_hash is null or length(trim(p_token_hash))<16 or p_scanner_user_id is null then
    raise exception 'invalid claim request' using errcode='22023';
  end if;

  select * into v_session
  from public.stamp_exchange_sessions
  where token_hash=p_token_hash
  for update;

  if v_session.id is null then
    raise exception 'QRコードが無効です' using errcode='P0001';
  end if;

  if v_session.status='open' and v_session.expires_at<=now() then
    update public.stamp_exchange_sessions
    set status='expired'
    where id=v_session.id;
    raise exception 'QRコードの有効期限が切れています' using errcode='P0001';
  end if;

  if v_session.issuer_user_id=p_scanner_user_id then
    raise exception '自分のQRコードは読み取れません' using errcode='P0001';
  end if;

  if v_session.status='paired' and v_session.scanner_user_id=p_scanner_user_id then
    return v_session.id;
  end if;

  if v_session.status<>'open' or v_session.scanner_user_id is not null then
    raise exception 'このQRコードはすでに使用されています' using errcode='P0001';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id=p_scanner_user_id
      and (
        p.role='admin'
        or exists(
          select 1 from public.user_permissions up
          where up.user_id=p.id and up.permission_code='S'
        )
      )
  ) then
    raise exception 'Stamp Rallyの利用権限がありません' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.user_ca_identities i
    join public.ca_members m on m.id=i.ca_member_id
    where i.user_id=p_scanner_user_id
      and i.is_primary
      and m.status='active'
      and m.ca_level in ('1st','2nd')
  ) then
    raise exception '交換用CA本人情報が設定されていません' using errcode='P0001';
  end if;

  update public.stamp_exchange_sessions
  set scanner_user_id=p_scanner_user_id,
      status='paired',
      paired_at=now()
  where id=v_session.id;

  return v_session.id;
end;
$$;

revoke all on function public.stamp_exchange_claim_internal(text,uuid)
  from public,anon,authenticated;
grant execute on function public.stamp_exchange_claim_internal(text,uuid)
  to service_role;

create or replace function public.stamp_exchange_confirm_internal(
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.stamp_exchange_sessions%rowtype;
  v_result jsonb;
begin
  select * into v_session
  from public.stamp_exchange_sessions
  where id=p_session_id
  for update;

  if v_session.id is null then
    raise exception '交換セッションが見つかりません' using errcode='P0001';
  end if;

  if p_actor_user_id<>v_session.issuer_user_id
     and p_actor_user_id is distinct from v_session.scanner_user_id then
    raise exception 'この交換には参加していません' using errcode='42501';
  end if;

  if v_session.status='completed' then
    return coalesce(v_session.result,'{}'::jsonb)
      || jsonb_build_object('session_id',v_session.id,'session_status','completed');
  end if;

  if v_session.status<>'paired' or v_session.scanner_user_id is null then
    raise exception 'まだ交換確認を行えません' using errcode='P0001';
  end if;

  if p_actor_user_id=v_session.issuer_user_id then
    update public.stamp_exchange_sessions
    set issuer_confirmed=true
    where id=v_session.id;
  else
    update public.stamp_exchange_sessions
    set scanner_confirmed=true
    where id=v_session.id;
  end if;

  select * into v_session
  from public.stamp_exchange_sessions
  where id=p_session_id;

  if v_session.issuer_confirmed and v_session.scanner_confirmed then
    v_result:=public.stamp_exchange_pair_internal(
      v_session.exchange_key,
      v_session.issuer_user_id,
      v_session.scanner_user_id,
      'normal',
      null,
      null,
      'Asia/Tokyo'
    );

    update public.stamp_exchange_sessions
    set status='completed',
        result=v_result,
        completed_at=now()
    where id=v_session.id;

    return v_result
      || jsonb_build_object('session_id',v_session.id,'session_status','completed');
  end if;

  return jsonb_build_object(
    'ok',true,
    'session_id',v_session.id,
    'session_status','paired',
    'issuer_confirmed',v_session.issuer_confirmed,
    'scanner_confirmed',v_session.scanner_confirmed
  );
end;
$$;

revoke all on function public.stamp_exchange_confirm_internal(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.stamp_exchange_confirm_internal(uuid,uuid)
  to service_role;

create or replace function public.stamp_exchange_cancel_internal(
  p_session_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.stamp_exchange_sessions%rowtype;
begin
  select * into v_session
  from public.stamp_exchange_sessions
  where id=p_session_id
  for update;

  if v_session.id is null then
    return false;
  end if;

  if p_actor_user_id<>v_session.issuer_user_id
     and p_actor_user_id is distinct from v_session.scanner_user_id then
    raise exception 'この交換には参加していません' using errcode='42501';
  end if;

  if v_session.status in ('completed','cancelled','expired') then
    return false;
  end if;

  update public.stamp_exchange_sessions
  set status='cancelled'
  where id=v_session.id;
  return true;
end;
$$;

revoke all on function public.stamp_exchange_cancel_internal(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.stamp_exchange_cancel_internal(uuid,uuid)
  to service_role;
