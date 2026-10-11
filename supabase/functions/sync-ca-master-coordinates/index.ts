/**
 * Permanently retired independent CA-master coordinate writer.
 *
 * The protected sync-ca-master pipeline already hydrates coordinates via
 * internal_update_ca_master_coordinates after source validation and lease
 * acquisition. This old entrypoint bypassed the dedicated pause gate, used an
 * older CSV tab, and could overwrite the 2099 emergency-stop sentinel via
 * sync_automation_state.last_ca_master_at. Never forward requests from here
 * to the writer. Reintroducing a separate writer requires a separate review.
 */
Deno.serve((_req: Request) =>
  new Response(
    JSON.stringify({
      ok: false,
      code: "CA_MASTER_COORDINATES_RETIRED",
      error: "Independent CA master coordinate synchronization is disabled.",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  )
);
