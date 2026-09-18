import { NextResponse } from "next/server";
import {
  DEFAULT_CA_MASTER_SHEET,
  parseCaMasterCsv,
  toCsvExportUrl,
} from "@/lib/ca-master";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin credentials are not configured" },
      { status: 503 },
    );
  }

  const source = process.env.CA_MASTER_SOURCE_URL || DEFAULT_CA_MASTER_SHEET;
  const response = await fetch(toCsvExportUrl(source), { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(
      { error: "CA master source fetch failed", status: response.status },
      { status: 502 },
    );
  }

  const records = parseCaMasterCsv(await response.text());
  const usable = records.filter((record) => record.communityId);

  const communityRows = Array.from(
    new Map(
      usable.map((record) => [
        record.communityId,
        {
          campfire_community_id: record.communityId,
          name: record.communityName,
          prefecture: record.prefecture,
          campfire_url: record.campfireUrl || null,
          latitude: record.latitude,
          longitude: record.longitude,
          fetched_at: new Date().toISOString(),
        },
      ]),
    ).values(),
  );

  const { error: communityError } = await supabase
    .from("communities")
    .upsert(communityRows, { onConflict: "campfire_community_id" });
  if (communityError) throw communityError;

  const communityIds = communityRows
    .map((row) => row.campfire_community_id)
    .filter((value): value is string => Boolean(value));

  const { data: communities, error: communitySelectError } = await supabase
    .from("communities")
    .select("id,campfire_community_id")
    .in("campfire_community_id", communityIds);
  if (communitySelectError) throw communitySelectError;

  const caRows = usable.map((record) => ({
    source_key: record.sourceKey,
    trainer_name: record.trainerName,
    ca_level: record.caLevel,
    prefecture: record.prefecture,
    join_date: record.joinDate,
    status: record.status || null,
    latitude: record.latitude,
    longitude: record.longitude,
  }));

  const { error: caError } = await supabase
    .from("ca_members")
    .upsert(caRows, { onConflict: "source_key" });
  if (caError) throw caError;

  const sourceKeys = caRows.map((row) => row.source_key);
  const { data: caMembers, error: caSelectError } = await supabase
    .from("ca_members")
    .select("id,source_key")
    .in("source_key", sourceKeys);
  if (caSelectError) throw caSelectError;

  const communityMap = new Map(
    (communities ?? []).map((row) => [row.campfire_community_id, row.id]),
  );
  const caMap = new Map((caMembers ?? []).map((row) => [row.source_key, row.id]));

  const links = usable.flatMap((record) => {
    if (!record.communityId) return [];
    const communityId = communityMap.get(record.communityId);
    const caMemberId = caMap.get(record.sourceKey);
    if (!communityId || !caMemberId) return [];
    return [{ community_id: communityId, ca_member_id: caMemberId }];
  });

  if (links.length) {
    const { error: linkError } = await supabase
      .from("community_ca_members")
      .upsert(links, { onConflict: "community_id,ca_member_id" });
    if (linkError) throw linkError;
  }

  await supabase.from("sync_runs").insert({
    source: "ca_members_map",
    status: "success",
    finished_at: new Date().toISOString(),
    details: {
      source_rows: records.length,
      usable_rows: usable.length,
      communities: communityRows.length,
      links: links.length,
    },
  });

  return NextResponse.json({
    ok: true,
    sourceRows: records.length,
    usableRows: usable.length,
    communities: communityRows.length,
    caMembers: caRows.length,
    links: links.length,
  });
}
