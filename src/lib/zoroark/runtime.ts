// Server-side configuration only. No generic DATABASE_URL fallback.
import { neon } from "@neondatabase/serverless";

const BRANCH = "feature/zoroark-guest-invite-chat-isolated-20261113";
export type Kind = "gm" | "guest";
export function runtimeConfig(kind: Kind, env = process.env) {
  const target = env.VERCEL_ENV;
  if (target !== "preview" && target !== "production") return null;
  if (target === "preview" && env.VERCEL_GIT_COMMIT_REF !== BRANCH) return null;
  if (target === "production" && (env.VERCEL_GIT_COMMIT_REF !== "main" ||
      env.ZOROARK_PRODUCTION_ENABLED !== "true")) return null;
  const url = kind === "gm" ? env.ZOROARK_NEON_GM_DATABASE_URL : env.ZOROARK_NEON_GUEST_DATABASE_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const expectedHost = target === "preview" ? QA_HOST : PROD_HOST;
    if (!["postgres:","postgresql:"].includes(parsed.protocol) ||
        parsed.hostname.replace("-pooler.", ".") !== expectedHost ||
        parsed.pathname !== "/zoroark_prod" || parsed.username !== `zoroark_runtime_${kind}` ||
        parsed.searchParams.get("sslmode") !== "require" || !parsed.password) return null;
    return { url, target, role: `zoroark_runtime_${kind}` };
  } catch { return null; }
}
// Hosts are non-secret identifiers pinned to silent-sea-07101633 endpoints.
const QA_HOST = "ep-frosty-grass-betfuvsp.c-9.us-east-2.aws.neon.tech";
const PROD_HOST = "ep-billowing-unit-beco2lbg.c-9.us-east-2.aws.neon.tech";

export async function runtimeDatabase(kind: Kind) {
  const config = runtimeConfig(kind);
  if (!config) throw Error("runtime_not_configured");
  const sql = neon(config.url);
  const [id] = await sql`select * from zoroark_isolated.runtime_identity()`;
  if (id?.database_name !== "zoroark_prod" || id?.role_name !== config.role ||
      id?.target !== config.target || id?.version !== 3) throw Error("runtime_identity_mismatch");
  return sql;
}

export class BodyError extends Error {
  constructor(public status: number) { super("invalid_request_body"); }
}
export async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2048)) throw new BodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new BodyError(400);
  let size=0;
  const chunks: Uint8Array[]=[];
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>2048) { await reader.cancel(); throw new BodyError(413); }
      chunks.push(value);
    }
    const bytes=new Uint8Array(size); let offset=0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  } catch(error) { if(error instanceof BodyError) throw error; throw new BodyError(400); }
  finally { reader.releaseLock(); }
}
export function sameOrigin(request: Request) {
  const origin=new URL(request.url).origin;
  const site=request.headers.get("sec-fetch-site");
  return request.headers.get("origin")===origin && (!site || site==="same-origin");
}
