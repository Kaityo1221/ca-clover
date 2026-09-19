import { createClient } from "npm:@supabase/supabase-js@2";

type CampfireMember = {
  rsvp_status?: string | null;
};

type CampfireEvent = {
  id?: string;
  name?: string;
  address?: string;
  details?: string;
  url?: string;
  time?: string;
  end_time?: string;
  created_by_community_ambassador?: boolean;
  accepted?: number;
  checked_in?: number;
  declined?: number;
  campfire_live_event_name?: string;
  campfire_live_event?: { name?: string | null } | null;
  members?: CampfireMember[] | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusCount(members: CampfireMember[], status: string) {
  return members.filter((member) => member?.rsvp_status === status).length;
}

async function fetchWithTimeout(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CA-Clover/0.1 (+https://ca-clover.vercel.app)",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Supabase environment is incomplete");
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const offset = Math.max(0, Number(body.offset ?? 0) || 0);
    const limit = Math.max(1, Math.min(10, Number(body.limit ?? 10) || 10));
    const communityId = typeof body.communityId === "string" ? body.communityId : null;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = admin
      .from("communities")
      .select("id,name,campfire_community_id", { count: "exact" })
      .not("campfire_community_id", "is", null)
      .order("name");

    if (communityId) {
      query = query.eq("id", communityId);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: communities, error: communityError, count } = await query;
    if (communityError) throw communityError;

    const { data: run, error: runError } = await admin
      .from("sync_runs")
      .insert({
        source: "cmpf-tools",
        status: "running",
        details: {
          offset,
          limit,
          requested_community_id: communityId,
          batch_size: communities?.length ?? 0,
        },
      })
      .select("id")
      .single();

    if (runError) throw runError;

    const baseUrl = (Deno.env.get("CMPF_TOOLS_BASE_URL") || "https://cmpf-tools.de").replace(/\/$/, "");
    const results: Array<Record<string, unknown>> = [];
    let importedEvents = 0;
    let failedCommunities = 0;
    let noDataCommunities = 0;

    for (const community of communities ?? []) {
      const clubId = community.campfire_community_id;
      if (!clubId) continue;

      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/api/clubs/${encodeURIComponent(clubId)}/events`,
        );

        if (response.status === 404) {
          noDataCommunities += 1;
          await admin
            .from("communities")
            .update({ fetched_at: new Date().toISOString() })
            .eq("id", community.id);
          results.push({
            community_id: community.id,
            name: community.name,
            status: "no_data",
            events: 0,
          });
          await sleep(200);
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const events: CampfireEvent[] = Array.isArray(payload) ? payload : [];

        const rows = events.flatMap((event) => {
          if (!event.id || !event.name) return [];

          const members = Array.isArray(event.members) ? event.members : [];
          const accepted = Number.isFinite(event.accepted)
            ? Number(event.accepted)
            : statusCount(members, "ACCEPTED");
          const checkedIn = Number.isFinite(event.checked_in)
            ? Number(event.checked_in)
            : statusCount(members, "CHECKED_IN");
          const declined = Number.isFinite(event.declined)
            ? Number(event.declined)
            : statusCount(members, "DECLINED");
          const rsvpCount = members.length || accepted + checkedIn + declined;

          return [{
            campfire_meetup_id: event.id,
            community_id: community.id,
            title: event.name,
            starts_at: event.time || null,
            ends_at: event.end_time || null,
            location: event.address || null,
            event_url: event.url || null,
            details: event.details || null,
            is_ca_meetup: Boolean(event.created_by_community_ambassador),
            rsvp_count: rsvpCount,
            checkin_count: checkedIn,
            accepted_count: accepted,
            declined_count: declined,
            campfire_live_event_name:
              event.campfire_live_event_name ||
              event.campfire_live_event?.name ||
              null,
            source: "cmpf-tools",
            fetched_at: new Date().toISOString(),
          }];
        });

        if (rows.length) {
          const { error: meetupError } = await admin
            .from("meetups")
            .upsert(rows, { onConflict: "campfire_meetup_id" });
          if (meetupError) throw meetupError;

          const dates = rows
            .map((row) => row.starts_at)
            .filter((value): value is string => Boolean(value))
            .map((value) => new Date(value).getTime())
            .filter(Number.isFinite);

          const patch: Record<string, unknown> = {
            coverage: "partial",
            fetched_at: new Date().toISOString(),
          };

          if (dates.length) {
            patch.coverage_from = new Date(Math.min(...dates)).toISOString();
            patch.coverage_to = new Date(Math.max(...dates)).toISOString();
          }

          await admin.from("communities").update(patch).eq("id", community.id);
          importedEvents += rows.length;
        } else {
          noDataCommunities += 1;
          await admin
            .from("communities")
            .update({ fetched_at: new Date().toISOString() })
            .eq("id", community.id);
        }

        results.push({
          community_id: community.id,
          name: community.name,
          status: rows.length ? "partial" : "no_data",
          events: rows.length,
        });
      } catch (error) {
        failedCommunities += 1;
        results.push({
          community_id: community.id,
          name: community.name,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(200);
    }

    const finalStatus = failedCommunities > 0 ? "partial" : "success";
    await admin
      .from("sync_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        details: {
          offset,
          limit,
          requested_community_id: communityId,
          total_available: count ?? null,
          processed_communities: communities?.length ?? 0,
          imported_events: importedEvents,
          failed_communities: failedCommunities,
          no_data_communities: noDataCommunities,
          results,
          note: "cmpf-tools coverage may be incomplete; participant identities are not stored",
        },
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        ok: true,
        status: finalStatus,
        offset,
        limit,
        total: count ?? communities?.length ?? 0,
        processed: communities?.length ?? 0,
        importedEvents,
        failedCommunities,
        noDataCommunities,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
