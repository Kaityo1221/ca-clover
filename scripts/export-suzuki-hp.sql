-- SuzukiPM daily aggregate: ONE read-only statement, existing Clover data only.
-- Do not call Campfire or run a sync. Use a DB role authorized for this read.
WITH completed AS (
  SELECT snapshot_date,started_at,finished_at,cardinality(failed_community_ids) AS failures
  FROM public.community_member_sync_state WHERE id=1
), totals AS (
  SELECT prefecture,COUNT(*)::integer AS communities,SUM(member_count)::bigint AS hp
  FROM public.communities
  WHERE prefecture IS NOT NULL AND member_count IS NOT NULL AND member_count>0
  GROUP BY prefecture
), payload AS (
  SELECT jsonb_build_object(
    'version',1,
    'source','CA Clover stored community member totals, prefecture aggregate',
    'generatedAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'syncComplete',true,
    'prefectures',jsonb_object_agg(prefecture,jsonb_build_object('hp',hp,'communities',communities))
  ) AS doc FROM totals
)
SELECT CASE WHEN EXISTS(
  SELECT 1 FROM completed
  WHERE finished_at IS NOT NULL
    AND started_at IS NOT NULL
    AND finished_at >= started_at
    AND COALESCE(failures,1) = 0
) THEN (SELECT doc::text FROM payload) ELSE NULL END AS snapshot;
