import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Disposable PostgreSQL cluster for GitHub Actions, never connects to production.
 * The test creates all roles/data in a private temp PGDATA with networking OFF.
 */
if (process.env.GITHUB_ACTIONS !== "true" || process.platform === "win32") {
  console.log("ZOROARK_PG_ISOLATED_SKIPPED: Only supported on ephemeral GitHub Actions Linux runner");
  process.exit(0);
}
const base = "/usr/lib/postgresql";
const versions = existsSync(base) ? readdirSync(base).sort((a,b) => b.localeCompare(a,undefined,{numeric:true})) : [];
const dirs = [
  ...(process.env.PG_BIN ? [process.env.PG_BIN] : []),
  ...versions.map(v => path.join(base,v,"bin")),
  "/usr/local/pgsql/bin",
];
const findBinary = name => {
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  const located = spawnSync("which",[name],{encoding:"utf8"});
  return located.status===0 ? located.stdout.trim() : null;
};
const initdb = findBinary("initdb"), ctl = findBinary("pg_ctl"), psql = findBinary("psql");
if (!initdb || !ctl || !psql) {
  console.error("ZOROARK_PG_ISOLATED_MISSING_BINARY: no disposable Postgres server available on runner; not a PASS");
  process.exit(1);
}
const root = mkdtempSync(path.join(tmpdir(), "zoroark-rls-"));
const pgdata = path.join(root,"cluster");
const socket = path.join(root,"socket");
const logs = path.join(root,"postgres.log");
mkdirSync(socket, {mode:0o700});
let started=false;
function exec(cmd,args, extraEnv={}) {
  const r=spawnSync(cmd,args,{
    env:{...process.env,...extraEnv},
    encoding:"utf8",
    timeout:90000,
    maxBuffer:1024*1024,
  });
  if(r.status!==0 || r.error) {
    throw Error("postgres process failed: "+path.basename(cmd)+" exit="+r.status+
      " error="+(r.error?.message||"")+" stderr="+(r.stderr||"").slice(-2500)+
      " stdout="+(r.stdout||"").slice(-2500));
  }
  return (r.stdout||"")+"\n"+(r.stderr||"");
}
try{
  exec(initdb,["-D",pgdata,"-A","trust","--no-instructions","--no-locale"]);
  exec(ctl,["-D",pgdata,"-l",logs,"-o",
    "-c listen_addresses='' -c unix_socket_directories="+socket+" -c port=5432",
    "-w","start"]);
  started=true;
  const fixture=fileURLToPath(new URL("./fixtures/zoroark-rls-isolated.sql",import.meta.url));
  const output=exec(psql,["-X","-v","ON_ERROR_STOP=1","-h",socket,"-p","5432",
    "-d","postgres","-f",fixture]);
  const expected=[
    "ZOROARK_PG_CA_SELF_READ_PASS",
    "ZOROARK_PG_FORGED_META_DENIED_PASS",
    "ZOROARK_PG_SELF_ROLE_ESCALATION_DENIED_PASS",
    "ZOROARK_PG_SELF_NIANTIC_UPDATE_PASS",
    "ZOROARK_PG_ADMIN_READ_PASS",
    "ZOROARK_PG_PENDING_DENIED_PASS",
    "ZOROARK_PG_LIVE_REVOCATION_PASS",
    "ZOROARK_PG_OTHER_USER_ISOLATION_PASS",
    "ZOROARK_PG_ANON_DENIED_PASS",
    "ZOROARK_PG_RLS_ISOLATED_PASS"
  ];
  const missing=expected.filter(m=>!output.includes(m));
  if(missing.length) throw Error("Missing required Postgres checks: "+missing.join(", "));
  console.log("ZOROARK_PG_RLS_ISOLATED_PASS actual PostgreSQL checks="+expected.length+
    " network_disabled=true production_db_access=false");
}catch(error){
  console.error("ZOROARK_PG_RLS_ISOLATED_FAIL",error.message);
  if(existsSync(logs)) console.error("POSTGRES_LOG_TAIL",readFileSync(logs,"utf8").slice(-2200));
  process.exitCode=1;
}finally{
  if(started){
    try{exec(ctl,["-D",pgdata,"-m","immediate","-w","stop"]);}catch(e){
      console.error("ZOROARK_PG_STOP_WARNING",e.message);
      process.exitCode=1;
    }
  }
  rmSync(root,{recursive:true,force:true});
}
