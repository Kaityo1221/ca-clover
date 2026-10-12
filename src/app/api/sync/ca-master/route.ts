import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Permanently retire the legacy master writer. The safe replacement is a
// separate reviewed release; this route must not write to Supabase.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "CA_MASTER_LEGACY_SYNC_DISABLED",
      error: "Legacy CA master synchronization is retired",
    },
    { status: 410 },
  );
}
