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

function communityIdentity(prefecture: string, communityName: string) {
  return `${prefecture}\u0000${communityName}`;
}

function displayCommunityIdentity(identity: string) {
  const [prefecture, communityName] = identity.split("\u0000");
  return { prefecture, community_name: communityName };
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
  const resolved = records.filter(
    (record): record is typeof record & { communityId: string } =>
      Boolean(record.communityId),
  );
  const unresolved = records.filter((record) => !record.communityId);

  // A source row is safe only when both directions are unambiguous:
  // 1 Community ID -> 1 prefecture/name, and 1 prefecture/name -> 1 Community ID.
  // If the source is stale or internally inconsistent, keep the last-known-good
  // DB relationship instead of collapsing or overwriting Communities.
  const idToIdentities = new Map<string, Set<string>>();
  const identityToIds = new Map<string, Set<string>>();

  for (const record of resolved) {
    const identity = communityIdentity(record.prefecture, record.communityName);

    const identities = idToIdentities.get(record.communityId) ?? new Set<string>();
    identities.add(identity);
    idToIdentities.set(record.communityId, identities);

    const ids = identityToIds.get(identity) ?? new Set<string>();
    ids.add(record.communityId);
    identityToIds.set(identity, ids);
  }

  const conflictingCommunityIds = new Set(
    Array.from(idToIdentities.entries())
      .filter(([, identities]) => identities.size > 1)
      .map(([communityId]) => communityId),
  );

  const conflictingIdentities = new Set(
    Array.from(identityToIds.entries())
      .filter(([, ids]) => ids.size > 1)
      .map(([identity]) => identity),
  );

  const conflictRecords = resolved.filter((record) => {
    const identity = communityIdentity(record.prefecture, record.communityName);
    return (
      conflictingCommunityIds.has(record.communityId) ||
      conflictingIdentities.has(identity)
    );
  });

  const safeResolved = resolved.filter((record) => {
    const identity = communityIdentity(record.prefecture, record.communityName);
    return (
      !conflictingCommunityIds.has(record.communityId) &&
      !conflictingIdentities.has(identity)
    );
  });

  const conflicts = [
    ...Array.from(conflictingCommunityIds).map((communityId) => ({
      type: "community_id_shared_by_multiple_names",
      community_id: communityId,
      communities: Array.from(idToIdentities.get(communityId) ?? []).map(
        displayCommunityIdentity,
      ),
      source_keys: resolved
        .filter((record) => record.communityId === communityId)
        .map((record) => record.sourceKey),
    })),
    ...Array.from(conflictingIdentities).map((identity) => ({
      type: "community_name_has_multiple_ids",
      ...displayCommunityIdentity(identity),
      community_ids: Array.from(identityToIds.get(identity) ?? []),
      source_keys: resolved
        .filter(
          (record) =>
            communityIdentity(record.prefecture, record.communityName) === identity,
        )
        .map((record) => record.sourceKey),
    })),
  ];

  const communityRows = Array.from(
    new Map(
      safeResolved.map((record) => [
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

  if (communityRows.length) {
    const { error: communityError } = await supabase
      .from("communities")
      .upsert(communityRows, { onConflict: "campfire_community_id" });
    if (communityError) throw communityError;
  }

  const caRows = records.map((record) => ({
    source_key: record.sourceKey,
    trainer_name: record.trainerName,
    ca_level: record.caLevel,
    prefecture: record.prefecture,
    join_date: record.joinDate,
    status: record.status || "active",
    latitude: record.latitude,
    longitude: record.longitude,
  }));

  if (caRows.length) {
    const { error: caError } = await supabase
      .from("ca_members")
      .upsert(caRows, { onConflict: "source_key" });
    if (caError) throw caError;
  }

  const sourceKeys = caRows.map((row) => row.source_key);
  const { data: caMembers, error: caSelectError } = await supabase
    .from("ca_members")
    .select("id,source_key")
    .in("source_key", sourceKeys);
  if (caSelectError) throw caSelectError;

  const communityIds = communityRows.map((row) => row.campfire_community_id);
  const communities = communityIds.length
    ? await supabase
        .from("communities")
        .select("id,campfire_community_id")
        .in("campfire_community_id", communityIds)
    : { data: [], error: null };

  if (communities.error) throw communities.error;

  const communityMap = new Map(
    (communities.data ?? []).map((row) => [row.campfire_community_id, row.id]),
  );
  const caMap = new Map((caMembers ?? []).map((row) => [row.source_key, row.id]));

  // Only replace links for unambiguous source rows. Conflicted and unresolved
  // rows preserve their last-known-good relationship until the source is fixed.
  const safeSourceKeys = new Set(safeResolved.map((record) => record.sourceKey));
  const managedCaIds = (caMembers ?? [])
    .filter((row) => safeSourceKeys.has(row.source_key))
    .map((row) => row.id);

  if (managedCaIds.length) {
    const { error: deleteLinkError } = await supabase
      .from("community_ca_members")
      .delete()
      .in("ca_member_id", managedCaIds);
    if (deleteLinkError) throw deleteLinkError;
  }

  const links = safeResolved.flatMap((record) => {
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

  const isPartial = unresolved.length > 0 || conflicts.length > 0;

  await supabase.from("sync_runs").insert({
    source: "ca_members_map",
    status: isPartial ? "partial" : "success",
    finished_at: new Date().toISOString(),
    details: {
      source_rows: records.length,
      resolved_rows: resolved.length,
      safe_resolved_rows: safeResolved.length,
      unresolved_rows: unresolved.length,
      conflict_rows: conflictRecords.length,
      conflicts,
      communities: communityRows.length,
      ca_members: caRows.length,
      links: links.length,
    },
  });

  return NextResponse.json({
    ok: true,
    sourceRows: records.length,
    resolvedRows: resolved.length,
    safeResolvedRows: safeResolved.length,
    unresolvedRows: unresolved.length,
    conflictRows: conflictRecords.length,
    conflicts,
    communities: communityRows.length,
    caMembers: caRows.length,
    links: links.length,
  });
}
