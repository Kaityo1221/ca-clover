import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired unsafe Next.js CA-master writer.
 *
 * This endpoint previously deleted every community_ca_members link for each
 * managed CA before recreating them. That operation can cascade into verified
 * user_ca_identities. Never restore this writer or forward to a write-capable
 * service until all safety gates, leases and identity protections are reviewed.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "CA_MASTER_LEGACY_SYNC_DISABLED",
      error: "This legacy CA master synchronization endpoint is permanently disabled.",
    },
    { status: 410 },
  );
}
