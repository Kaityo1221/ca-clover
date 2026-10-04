create or replace function public.stamp_kanto_open_connections()
returns table(
  pair_key text,
  prefecture_a text,
  prefecture_b text
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or exists(
          select 1
          from public.user_permissions up
          where up.user_id = p.id
            and up.permission_code = 'S'
        )
      )
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

revoke all on function public.stamp_kanto_open_connections() from public;
grant execute on function public.stamp_kanto_open_connections() to authenticated;

comment on function public.stamp_kanto_open_connections() is
  'Returns only opened inter-prefecture Kanto Stamp Rally connections for authenticated Stamp Rally users. No user IDs or exchange details are exposed.';
