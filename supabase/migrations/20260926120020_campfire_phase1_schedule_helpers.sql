create or replace function public.internal_phase1_jst_date()
returns date
language sql
stable
as $$
  select (timezone('Asia/Tokyo', now()))::date
$$;

revoke all on function public.internal_phase1_jst_date() from public,anon,authenticated;
grant execute on function public.internal_phase1_jst_date() to service_role;
