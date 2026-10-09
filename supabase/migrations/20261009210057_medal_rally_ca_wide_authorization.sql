-- Supabase migration applied to project wgiittrvgtiosogyhfcl on 2026-10-10 JST. Preserve history.
-- Allow role=ca/admin; QR exchange still validates active 1st/2nd identity.
-- Existing medal, exchange, reunion and event records are untouched.
-- Keep internal SECURITY DEFINER functions limited to service_role.

-- stamp_exchange_claim_internal
CREATE OR REPLACE FUNCTION public.stamp_exchange_claim_internal(p_token_hash text, p_scanner_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
      and p.role in ('ca','admin')
  ) then
    raise exception 'Stamp Rallyの利用権限がありません' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_session.issuer_user_id and p.role in ('ca','admin')
  ) then
    raise exception 'QR発行者のCA認証を確認できません' using errcode='42501';
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
$function$;


-- stamp_exchange_pair_internal
CREATE OR REPLACE FUNCTION public.stamp_exchange_pair_internal(p_exchange_key uuid, p_caller_user_id uuid, p_partner_user_id uuid, p_source text DEFAULT 'normal'::text, p_location text DEFAULT NULL::text, p_event_name text DEFAULT NULL::text, p_timezone text DEFAULT 'Asia/Tokyo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_now timestamptz := now();
  v_local_date date;
  v_user_a uuid;
  v_user_b uuid;
  v_existing public.stamp_exchange_transactions%rowtype;

  v_caller_ca uuid;
  v_caller_community uuid;
  v_caller_level text;
  v_caller_status text;
  v_caller_message text;

  v_partner_ca uuid;
  v_partner_community uuid;
  v_partner_level text;
  v_partner_status text;
  v_partner_message text;

  v_collection_caller uuid;
  v_collection_partner uuid;
  v_reunion_caller uuid;
  v_reunion_partner uuid;
  v_status_caller text;
  v_status_partner text;
  v_result jsonb;
  v_inserted_key uuid;
begin
  if p_exchange_key is null or p_caller_user_id is null or p_partner_user_id is null then
    raise exception 'exchange key and both users are required' using errcode='22023';
  end if;
  if p_caller_user_id=p_partner_user_id then
    raise exception 'self exchange is not allowed' using errcode='22023';
  end if;
  if p_source not in ('normal','event','bulk','admin','import') then
    raise exception 'invalid exchange source' using errcode='22023';
  end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'invalid timezone' using errcode='22023';
  end if;

  v_local_date := (v_now at time zone p_timezone)::date;

  if p_caller_user_id::text < p_partner_user_id::text then
    v_user_a:=p_caller_user_id;
    v_user_b:=p_partner_user_id;
  else
    v_user_a:=p_partner_user_id;
    v_user_b:=p_caller_user_id;
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_caller_user_id
      and p.role in ('ca','admin')
  ) then
    raise exception 'caller does not have Stamp Rally access' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_partner_user_id
      and p.role in ('ca','admin')
  ) then
    raise exception 'partner does not have Stamp Rally access' using errcode='42501';
  end if;

  insert into public.stamp_exchange_transactions(
    exchange_key,user_a_id,user_b_id,source,location,event_name,timezone,local_date,status
  )
  values(
    p_exchange_key,v_user_a,v_user_b,p_source,
    nullif(trim(p_location),''),
    nullif(trim(p_event_name),''),
    p_timezone,v_local_date,'processing'
  )
  on conflict(exchange_key) do nothing
  returning exchange_key into v_inserted_key;

  if v_inserted_key is null then
    select * into v_existing
    from public.stamp_exchange_transactions
    where exchange_key=p_exchange_key;

    if v_existing.exchange_key is null then
      raise exception 'exchange transaction could not be resolved';
    end if;
    if not (
      v_existing.user_a_id=v_user_a
      and v_existing.user_b_id=v_user_b
    ) then
      raise exception 'exchange key belongs to another participant pair' using errcode='23505';
    end if;
    if v_existing.status='completed' and v_existing.result is not null then
      return v_existing.result || jsonb_build_object('idempotent_replay',true);
    end if;
    raise exception 'exchange is already processing' using errcode='55P03';
  end if;

  select i.ca_member_id,i.community_id,m.ca_level,m.status
    into v_caller_ca,v_caller_community,v_caller_level,v_caller_status
  from public.user_ca_identities i
  join public.ca_members m on m.id=i.ca_member_id
  where i.user_id=p_caller_user_id and i.is_primary
  limit 1;

  select i.ca_member_id,i.community_id,m.ca_level,m.status
    into v_partner_ca,v_partner_community,v_partner_level,v_partner_status
  from public.user_ca_identities i
  join public.ca_members m on m.id=i.ca_member_id
  where i.user_id=p_partner_user_id and i.is_primary
  limit 1;

  select nullif(trim(stamp_exchange_message),'')
    into v_caller_message
  from public.profiles
  where id=p_caller_user_id;

  select nullif(trim(stamp_exchange_message),'')
    into v_partner_message
  from public.profiles
  where id=p_partner_user_id;

  if v_caller_ca is null or v_partner_ca is null then
    raise exception 'both users need a primary CA identity before exchanging' using errcode='P0001';
  end if;
  if v_caller_status<>'active' or v_partner_status<>'active'
     or v_caller_level not in ('1st','2nd')
     or v_partner_level not in ('1st','2nd') then
    raise exception 'both CA identities must be active 1st/2nd' using errcode='P0001';
  end if;

  insert into public.stamp_collections(
    owner_user_id,stamp_ca_member_id,community_id,role_at_acquisition,
    first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_message
  )
  values(
    p_caller_user_id,v_partner_ca,v_partner_community,v_partner_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source,v_partner_message
  )
  on conflict(owner_user_id,stamp_ca_member_id,community_id) do nothing
  returning id into v_collection_caller;

  if v_collection_caller is not null then
    v_status_caller:='new';
  else
    select id into v_collection_caller
    from public.stamp_collections
    where owner_user_id=p_caller_user_id
      and stamp_ca_member_id=v_partner_ca
      and community_id=v_partner_community;

    insert into public.stamp_reunions(
      collection_id,met_at,local_date,timezone,location,event_name,reunion_source
    )
    values(
      v_collection_caller,v_now,v_local_date,p_timezone,
      nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
    )
    on conflict(collection_id,local_date) where local_date is not null do nothing
    returning id into v_reunion_caller;

    v_status_caller:=case when v_reunion_caller is null then 'duplicate_same_day' else 'reunion' end;
  end if;

  insert into public.stamp_collections(
    owner_user_id,stamp_ca_member_id,community_id,role_at_acquisition,
    first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_message
  )
  values(
    p_partner_user_id,v_caller_ca,v_caller_community,v_caller_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source,v_caller_message
  )
  on conflict(owner_user_id,stamp_ca_member_id,community_id) do nothing
  returning id into v_collection_partner;

  if v_collection_partner is not null then
    v_status_partner:='new';
  else
    select id into v_collection_partner
    from public.stamp_collections
    where owner_user_id=p_partner_user_id
      and stamp_ca_member_id=v_caller_ca
      and community_id=v_caller_community;

    insert into public.stamp_reunions(
      collection_id,met_at,local_date,timezone,location,event_name,reunion_source
    )
    values(
      v_collection_partner,v_now,v_local_date,p_timezone,
      nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
    )
    on conflict(collection_id,local_date) where local_date is not null do nothing
    returning id into v_reunion_partner;

    v_status_partner:=case when v_reunion_partner is null then 'duplicate_same_day' else 'reunion' end;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'exchange_key',p_exchange_key,
    'occurred_at',v_now,
    'timezone',p_timezone,
    'local_date',v_local_date,
    'source',p_source,
    'idempotent_replay',false,
    'participants',jsonb_build_array(
      jsonb_build_object(
        'user_id',p_caller_user_id,
        'received_ca_member_id',v_partner_ca,
        'received_community_id',v_partner_community,
        'collection_id',v_collection_caller,
        'status',v_status_caller
      ),
      jsonb_build_object(
        'user_id',p_partner_user_id,
        'received_ca_member_id',v_caller_ca,
        'received_community_id',v_caller_community,
        'collection_id',v_collection_partner,
        'status',v_status_partner
      )
    )
  );

  update public.stamp_exchange_transactions
  set status='completed',result=v_result,completed_at=now()
  where exchange_key=p_exchange_key;

  return v_result;
end;
$function$;


-- stamp_kanto_open_connections
CREATE OR REPLACE FUNCTION public.stamp_kanto_open_connections()
 RETURNS TABLE(pair_key text, prefecture_a text, prefecture_b text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('ca','admin')
  ) then
    raise exception 'Stamp Rally access required' using errcode='42501';
  end if;

  return query
  with kanto(prefecture, ord) as (
    values
      ('茨城県'::text, 1),
      ('栃木県'::text, 2),
      ('群馬県'::text, 3),
      ('埼玉県'::text, 4),
      ('千葉県'::text, 5),
      ('東京都'::text, 6),
      ('神奈川県'::text, 7)
  ),
  primary_identity as (
    select distinct on (i.user_id)
      i.user_id,
      i.ca_member_id
    from public.user_ca_identities i
    where i.is_primary
    order by
      i.user_id,
      i.verified_at desc nulls last,
      i.created_at desc
  ),
  raw_pairs as (
    select
      ma.prefecture as prefecture_a_raw,
      mb.prefecture as prefecture_b_raw,
      ka.ord as ord_a,
      kb.ord as ord_b
    from public.stamp_exchange_transactions t
    join primary_identity ia on ia.user_id = t.user_a_id
    join primary_identity ib on ib.user_id = t.user_b_id
    join public.ca_members ma on ma.id = ia.ca_member_id
    join public.ca_members mb on mb.id = ib.ca_member_id
    join kanto ka on ka.prefecture = ma.prefecture
    join kanto kb on kb.prefecture = mb.prefecture
    where t.status = 'completed'
      and ma.prefecture <> mb.prefecture
  ),
  normalized as (
    select
      case when ord_a < ord_b then prefecture_a_raw else prefecture_b_raw end as prefecture_a,
      case when ord_a < ord_b then prefecture_b_raw else prefecture_a_raw end as prefecture_b,
      least(ord_a, ord_b) as ord_a,
      greatest(ord_a, ord_b) as ord_b
    from raw_pairs
  )
  select
    n.prefecture_a || '|' || n.prefecture_b as pair_key,
    n.prefecture_a,
    n.prefecture_b
  from normalized n
  group by n.prefecture_a, n.prefecture_b, n.ord_a, n.ord_b
  order by n.ord_a, n.ord_b;
end;
$function$;


-- stamp_rally_catalog
CREATE OR REPLACE FUNCTION public.stamp_rally_catalog()
 RETURNS TABLE(community_id uuid, community_name text, prefecture text, avatar_url text, avatar_thumbnail_path text, avatar_last_changed_at timestamp with time zone, ca_member_id uuid, trainer_name text, ca_level text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ca','admin')
  ) then
    raise exception 'stamp rally access required'
      using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.prefecture,
    c.avatar_url,
    c.avatar_thumbnail_path,
    c.avatar_last_changed_at,
    m.id,
    m.trainer_name,
    m.ca_level
  from public.communities c
  left join public.community_ca_members l
    on l.community_id = c.id
  left join public.ca_members m
    on m.id = l.ca_member_id
  order by c.prefecture nulls last, c.name, m.ca_level nulls last, m.trainer_name nulls last;
end;
$function$;


-- Explicitly preserve Data API execution boundaries.
REVOKE EXECUTE ON FUNCTION public.stamp_exchange_claim_internal(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_exchange_claim_internal(text,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.stamp_exchange_pair_internal(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_exchange_pair_internal(uuid,uuid,uuid,text,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.stamp_kanto_open_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_kanto_open_connections() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.stamp_rally_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_rally_catalog() TO authenticated, service_role;
