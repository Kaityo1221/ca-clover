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
  v_source text;
  v_location text;
  v_event_name text;
  v_timezone text;
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
      || jsonb_build_object(
        'session_id',v_session.id,
        'session_status','completed',
        'event_id',v_session.event_id
      );
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
    if v_session.event_id is not null then
      v_source:='event';
      v_location:=v_session.event_location;
      v_event_name:=v_session.event_name;
      v_timezone:=coalesce(v_session.event_timezone,'Asia/Tokyo');
    else
      v_source:='normal';
      v_location:=null;
      v_event_name:=null;
      v_timezone:='Asia/Tokyo';
    end if;

    v_result:=public.stamp_exchange_pair_internal(
      v_session.exchange_key,
      v_session.issuer_user_id,
      v_session.scanner_user_id,
      v_source,
      v_location,
      v_event_name,
      v_timezone
    );

    v_result:=v_result || jsonb_build_object(
      'event_id',v_session.event_id,
      'event_name',v_event_name,
      'event_location',v_location
    );

    update public.stamp_exchange_sessions
    set status='completed',
        result=v_result,
        completed_at=now()
    where id=v_session.id;

    return v_result
      || jsonb_build_object(
        'session_id',v_session.id,
        'session_status','completed'
      );
  end if;

  return jsonb_build_object(
    'ok',true,
    'session_id',v_session.id,
    'session_status','paired',
    'issuer_confirmed',v_session.issuer_confirmed,
    'scanner_confirmed',v_session.scanner_confirmed,
    'event_id',v_session.event_id
  );
end;
$$;

revoke all on function public.stamp_exchange_confirm_internal(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.stamp_exchange_confirm_internal(uuid,uuid)
  to service_role;

insert into public.stamp_mission_templates(title,instruction,is_active)
select seed.title,seed.instruction,true
from (values
  ('5秒ふるふる','みんなでスマホを持って5秒だけふるふる。終わったら交換スタート！'),
  ('みんなでポーズ','近くのCA同士で好きなポーズをひとつ決めてから交換しよう。'),
  ('ご当地ひとこと','今日いる街の好きなところをひとこと話してから交換しよう。'),
  ('推しポケ紹介','いま一番推しているポケモンを一匹だけ紹介してから交換しよう。'),
  ('ハイタッチ交換','できる人は軽くハイタッチしてから交換しよう。無理はしなくてOK。'),
  ('一期一会','初めて会ったCAに「はじめまして」を伝えてから交換しよう。')
) as seed(title,instruction)
where not exists(
  select 1 from public.stamp_mission_templates m where m.title=seed.title
);
