import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SOURCE_SHEET, parseCsv, parseMasterRows, compareMaster } from "@/lib/ca-master-diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SUPABASE_ORIGIN="https://wgiittrvgtiosogyhfcl.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const reply=(status,body)=>NextResponse.json({readOnly:true,updated:false,...body},{
  status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"},
});
function previewAllowed(){
  return process.env.VERCEL_ENV==="preview" &&
    process.env.VERCEL_GIT_COMMIT_REF==="feature/new-ca-approval-admin-preview-20261103";
}
export async function POST(request){
  if(!previewAllowed())return reply(503,{code:"PREVIEW_ONLY"});
  if(request.headers.get("origin")!==new URL(request.url).origin)
    return reply(403,{code:"ORIGIN_MISMATCH"});
  const authorization=request.headers.get("authorization")||"";
  if(!/^Bearer [\\w.-]{16,8192}$/.test(authorization))return reply(401,{code:"AUTH_REQUIRED"});
  // Strictly no client-selected spreadsheet, URL, table, or raw SQL.
  if(request.headers.get("content-length") && Number(request.headers.get("content-length"))>2)
    return reply(400,{code:"BODY_NOT_ALLOWED"});
  const authUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||SUPABASE_ORIGIN;
  if(authUrl!==SUPABASE_ORIGIN)return reply(503,{code:"AUTH_CONFIG_INVALID"});
  const supabase=createClient(authUrl,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||PUBLISHABLE_KEY,{
    global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false},
  });
  try{
    const {data:{user}={},error:authError}=await supabase.auth.getUser(authorization.slice(7));
    if(authError||!user)return reply(401,{code:"AUTH_REQUIRED"});
    const {data:profile,error:profileError}=await supabase.from("profiles")
      .select("role").eq("id",user.id).maybeSingle();
    if(profileError||profile?.role!=="admin")return reply(403,{code:"ADMIN_REQUIRED"});

    // Read a fixed authoritative sheet only. No user-supplied input is forwarded.
    const sourceUrl="https://docs.google.com/spreadsheets/d/"+SOURCE_SHEET.spreadsheetId+
      "/export?format=csv&gid="+SOURCE_SHEET.gid;
    const fetched=await fetch(sourceUrl,{method:"GET",cache:"no-store",redirect:"follow",
      signal:AbortSignal.timeout(15000),headers:{"Accept":"text/csv,text/plain"}});
    if(!fetched.ok)return reply(502,{code:"SOURCE_UNAVAILABLE"});
    const text=await fetched.text();
    if(text.length>8_000_000)return reply(502,{code:"SOURCE_OVERSIZE"});
    if(/<html|<!doctype html/i.test(text.slice(0,512)))return reply(502,{code:"SOURCE_ACCESS_REQUIRED"});
    const source=parseMasterRows(parseCsv(text));
    const {data:database,error:databaseError}=await supabase.from("ca_members")
      .select("source_key,trainer_name,ca_level,status,join_date").order("source_key").limit(1000);
    if(databaseError||!Array.isArray(database))
      return reply(503,{code:"MASTER_READ_UNAVAILABLE"});
    if(database.length>=1000)return reply(503,{code:"MASTER_RESULT_TRUNCATED"});
    const result=compareMaster(source,database);
    const issues=[...result.issues];
    // Every run is read-only. No CA role or roster update can be triggered.
    return reply(200,{
      code:issues.length?"REVIEW_REQUIRED":"DIFF_READY",
      source:{title:SOURCE_SHEET.title,tab:SOURCE_SHEET.tab,
        spreadsheetId:SOURCE_SHEET.spreadsheetId,backupId:SOURCE_SHEET.backupId,
        checkedAt:new Date().toISOString()},
      counts:{database:result.registered,active:result.active,source:result.sourceCount,
        newCandidates:result.added.length,changed:result.changed.length,missingFromSource:result.absent.length},
      newCandidates:result.added.map(r=>({trainerName:r.name,caLevel:r.level,status:r.status,
        communityName:r.community,prefecture:r.city,joinDate:r.joinDate})),
      changes:result.changed,missingFromSource:result.absent,
      warnings:issues,
      requiresAdminApproval:true,automaticWrite:false,
    });
  }catch{
    return reply(502,{code:"SOURCE_OR_COMPARISON_UNAVAILABLE"});
  }
}
