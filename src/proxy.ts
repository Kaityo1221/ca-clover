import {NextResponse} from "next/server";

// Registration talks directly to its isolated Supabase project. Keep unrelated
// Next APIs (including older clients with production fallbacks) unreachable in
// this one lab build. The flag is derived from the exact platform branch/env
// tuple in next.config.ts, not from a request header or a shared secret.
export function proxy() {
  if (process.env.NEXT_PUBLIC_CA_CLOVER_CLAIM_PREVIEW === "true") {
    return NextResponse.json({code: "CLAIM_LAB_API_DISABLED"}, {
      status: 503, headers: {"Cache-Control": "no-store"},
    });
  }
  return NextResponse.next();
}

export const config = {matcher: ["/api/:path*"]};
