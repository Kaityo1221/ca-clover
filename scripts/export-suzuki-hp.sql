-- SuzukiPM daily HP aggregate. Exactly ONE SELECT of existing stored counts.
-- No Campfire access, no sync initiation, no user-level records, no DB write.
WITH totals AS (
  SELECT prefecture,COUNT(*)::integer AS communities,SUM(member_count)::bigint AS hp
  FROM public.communities
  WHERE prefecture IS NOT NULL AND member_count IS NOT NULL AND member_count > 0
  GROUP BY prefecture
)
SELECT jsonb_build_object(
  'version',1,
  'source','CA Clover stored community member totals, prefecture aggregate',
  'snapshotReady',true,
  'generatedAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'prefectures',jsonb_object_agg(prefecture,jsonb_build_object('hp',hp,'communities',communities))
)::text AS public_snapshot
FROM totals;
