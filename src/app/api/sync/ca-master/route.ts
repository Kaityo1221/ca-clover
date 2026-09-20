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

type CommunityRow = {
  id: string;
  campfire_community_id: string | null;
  name: string;
  prefecture: string | null;
  campfire_url: string | null;
};

type HistoryRow = {
  community_id: string;
  campfire_community_id: string;
  status: "active" | "retired";
};

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

  const conflicts: Array<Record<string, unknown>> = [
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

  const [{ data: existingCommunities, error: communitiesError }, { data: historyRows, error: historyError }] =
    await Promise.all([
      supabase
        .from("communities")
        .select("id,campfire_community_id,name,prefecture,campfire_url"),
      supabase
        .from("community_campfire_ids")
        .select("community_id,campfire_community_id,status"),
    ]);
  if (communitiesError) throw communitiesError;
  if (historyError) throw historyError;

  const communities = (existingCommunities ?? []) as CommunityRow[];
  const history = (historyRows ?? []) as HistoryRow[];

  const currentByCampfireId = new Map(
    communities
      .filter((row) => row.campfire_community_id)
      .map((row) => [String(row.campfire_community_id), row]),
  );
  const historyByCampfireId = new Map(
    history.map((row) => [row.campfire_community_id, row]),
  );
  const communitiesById = new Map(communities.map((row) => [row.id, row]));
  const communitiesByIdentity = new Map<string, CommunityRow[]>();
  for (const row of communities) {
    const identity = communityIdentity(row.prefecture ?? "", row.name);
    const list = communitiesByIdentity.get(identity) ?? [];
    list.push(row);
    communitiesByIdentity.set(identity, list);
  }

  const sourceCommunityMap = new Map<string, string>();
  const uniqueSourceRecords = Array.from(
    new Map(safeResolved.map((record) => [record.communityId, record])).values(),
  );

  const createRows: Array<{
    campfire_community_id: string;
    name: string;
    prefecture: string;
    campfire_url: string | null;
    latitude: number | null;
    longitude: number | null;
    fetched_at: string;
  }> = [];

  for (const record of uniqueSourceRecords) {
    const current = currentByCampfireId.get(record.communityId);
    if (current) {
      sourceCommunityMap.set(record.communityId, current.id);
      continue;
    }

    const historical = historyByCampfireId.get(record.communityId);
    if (historical) {
      sourceCommunityMap.set(record.communityId, historical.community_id);
      continue;
    }

    const identity = communityIdentity(record.prefecture, record.communityName);
    const identityMatches = communitiesByIdentity.get(identity) ?? [];
    if (identityMatches.length === 1) {
      sourceCommunityMap.set(record.communityId, identityMatches[0].id);
      continue;
    }

    if (identityMatches.length > 1) {
      conflicts.push({
        type: "database_identity_ambiguous",
        community_id: record.communityId,
        community_name: record.communityName,
        prefecture: record.prefecture,
        community_candidates: identityMatches.map((row) => row.id),
        source_keys: safeResolved
          .filter((row) => row.communityId === record.communityId)
          .map((row) => row.sourceKey),
      });
      continue;
    }

    createRows.push({
      campfire_community_id: record.communityId,
      name: record.communityName,
      prefecture: record.prefecture,
      campfire_url: record.campfireUrl || null,
      latitude: record.latitude,
      longitude: record.longitude,
      fetched_at: new Date().toISOString(),
    });
  }

  if (createRows.length) {
    const { data: created, error: createError } = await supabase
      .from("communities")
      .upsert(createRows, { onConflict: "campfire_community_id" })
      .select("id,campfire_community_id,name,prefecture,campfire_url");
    if (createError) throw createError;

    for (const row of (created ?? []) as CommunityRow[]) {
      if (!row.campfire_community_id) continue;
      sourceCommunityMap.set(row.campfire_community_id, row.id);
      communitiesById.set(row.id, row);
    }

    const activeHistoryRows = (created ?? [])
      .filter((row) => row.campfire_community_id)
      .map((row) => ({
        community_id: row.id,
        campfire_community_id: row.campfire_community_id,
        status: "active",
        source: "ca-master-new",
        observed_name: row.name,
        last_seen_at: new Date().toISOString(),
        retired_at: null,
      }));
    if (activeHistoryRows.length) {
      const { error: activeHistoryError } = await supabase
        .from("community_campfire_ids")
        .upsert(activeHistoryRows, { onConflict: "campfire_community_id" });
      if (activeHistoryError) throw activeHistoryError;
    }
  }

  const metadataUpdates = new Map<string, {
    name: string;
    prefecture: string;
    latitude: number | null;
    longitude: number | null;
    fetched_at: string;
    campfire_url?: string | null;
  }>();
  const retiredHistoryRows: Array<{
    community_id: string;
    campfire_community_id: string;
    status: "retired";
    source: string;
    observed_name: string;
    last_seen_at: string;
    retired_at: string;
  }> = [];

  for (const record of uniqueSourceRecords) {
    const targetId = sourceCommunityMap.get(record.communityId);
    if (!targetId) continue;

    const target = communitiesById.get(targetId) ??
      communities.find((row) => row.id === targetId) ??
      null;

    const update: {
      name: string;
      prefecture: string;
      latitude: number | null;
      longitude: number | null;
      fetched_at: string;
      campfire_url?: string | null;
    } = {
      name: record.communityName,
      prefecture: record.prefecture,
      latitude: record.latitude,
      longitude: record.longitude,
      fetched_at: new Date().toISOString(),
    };

    if (target?.campfire_community_id === record.communityId) {
      update.campfire_url = record.campfireUrl || null;
    }
    metadataUpdates.set(targetId, update);

    if (
      target?.campfire_community_id &&
      target.campfire_community_id !== record.communityId &&
      !historyByCampfireId.has(record.communityId)
    ) {
      retiredHistoryRows.push({
        community_id: targetId,
        campfire_community_id: record.communityId,
        status: "retired",
        source: "ca-master-observed",
        observed_name: record.communityName,
        last_seen_at: new Date().toISOString(),
        retired_at: new Date().toISOString(),
      });
    }
  }

  for (const [communityId, update] of metadataUpdates) {
    const { error: updateError } = await supabase
      .from("communities")
      .update(update)
      .eq("id", communityId);
    if (updateError) throw updateError;
  }

  if (retiredHistoryRows.length) {
    const { error: retiredHistoryError } = await supabase
      .from("community_campfire_ids")
      .insert(retiredHistoryRows);
    if (retiredHistoryError) throw retiredHistoryError;
  }

  const sourceKeys = caRows.map((row) => row.source_key);
  const { data: caMembers, error: caSelectError } = sourceKeys.length
    ? await supabase
        .from("ca_members")
        .select("id,source_key")
        .in("source_key", sourceKeys)
    : { data: [], error: null };
  if (caSelectError) throw caSelectError;

  const caMap = new Map((caMembers ?? []).map((row) => [row.source_key, row.id]));
  const blockedSourceKeys = new Set([
    ...unresolved.map((record) => record.sourceKey),
    ...conflictRecords.map((record) => record.sourceKey),
    ...conflicts.flatMap((conflict) =>
      Array.isArray(conflict.source_keys)
        ? conflict.source_keys.map((value) => String(value))
        : [],
    ),
  ]);

  const managedSourceKeys = new Set(
    safeResolved
      .map((record) => record.sourceKey)
      .filter((sourceKey) => !blockedSourceKeys.has(sourceKey)),
  );
  const managedCaIds = (caMembers ?? [])
    .filter((row) => managedSourceKeys.has(row.source_key))
    .map((row) => row.id);

  if (managedCaIds.length) {
    const { error: deleteLinkError } = await supabase
      .from("community_ca_members")
      .delete()
      .in("ca_member_id", managedCaIds);
    if (deleteLinkError) throw deleteLinkError;
  }

  const links = safeResolved.flatMap((record) => {
    if (blockedSourceKeys.has(record.sourceKey)) return [];
    const communityId = sourceCommunityMap.get(record.communityId);
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
      communities_created: createRows.length,
      source_community_ids_mapped: sourceCommunityMap.size,
      historical_ids_recorded: retiredHistoryRows.length,
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
    communitiesCreated: createRows.length,
    sourceCommunityIdsMapped: sourceCommunityMap.size,
    historicalIdsRecorded: retiredHistoryRows.length,
    caMembers: caRows.length,
    links: links.length,
  });
}
