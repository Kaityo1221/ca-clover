revoke execute on function public.stamp_kanto_open_connections() from anon;
revoke all on function public.stamp_kanto_open_connections() from public;
grant execute on function public.stamp_kanto_open_connections() to authenticated;
grant execute on function public.stamp_kanto_open_connections() to service_role;
