-- Read-only daily export. Run exclusively with a least-privilege SELECT-only role.
-- If the CA Clover member sync has not fully finished, print NULL (blank in psql -Atq).
WITH gate AS (
  SELECT snapshot_date, finished_at, cardinality(failed_community_ids) AS failures
  FROM public.community_member_sync_state WHERE id=1
),
aggregated AS (
  SELECT prefecture, SUM(member_count)::bigint AS hp,
         COUNT(*)::int AS communities, MAX(fetched_at) AS latest_fetch
  FROM public.communities
  WHERE prefecture IS NOT NULL AND member_count IS NOT NULL AND member_count > 0
  GROUP BY prefecture
),
document AS (
  SELECT jsonb_build_object(
    'version', 1,
    'source', 'CA Clover prefecture member totals',
    'generatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'syncComplete', true,
    'prefectures', jsonb_object_agg(
      prefecture,
      jsonb_build_object('hp', hp, 'communities', communities, 'latestFetchedAt', latest_fetch)
    )
  ) AS payload FROM aggregated
)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM gate
  WHERE snapshot_date >= ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
    AND finished_at IS NOT NULL
    AND COALESCE(failures, 0) = 0
) THEN (SELECT payload::text FROM document) ELSE NULL END AS public_snapshot;
