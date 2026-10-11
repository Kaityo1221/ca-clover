/**
 * Phase D: spawn the actual, retired CA-master Edge entrypoints locally.
 * No Supabase credentials, network calls to production, or database mutations.
 */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";

const host="http://127.0.0.1:8000";
const cases=[
  {
    path:"supabase/functions/sync-ca-master-coordinates/index.ts",
    code:"CA_MASTER_COORDINATES_RETIRED",
  },
];

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function check(entry){
  const child=spawn("deno",["run","--allow-net",entry.path],{
    stdio:["ignore","pipe","pipe"],
    env:{
      PATH:process.env.PATH??"",
      HOME:process.env.HOME??"",
      DENO_DIR:process.env.DENO_DIR??"",
    },
  });
  let logs="";
  child.stdout.on("data",chunk=>{logs+=String(chunk).slice(0,500);});
  child.stderr.on("data",chunk=>{logs+=String(chunk).slice(0,500);});
  try{
    let ready=false;
    for(let i=0;i<50;i++){
      if(child.exitCode!==null)throw new Error("Edge child failed to start: "+logs.slice(-600));
      try{
        const response=await fetch(host+"/ping",{method:"GET",signal:AbortSignal.timeout(400)});
        if(response.status===410){ready=true;break;}
      }catch{/* waiting for the isolated listener */}
      await delay(100);
    }
    assert.ok(ready,"Edge service did not start: "+logs.slice(-600));
    for(const method of ["GET","POST","OPTIONS"]){
      const response=await fetch(host+"/functions/v1/test",{
        method,signal:AbortSignal.timeout(2000),
        headers:{"x-ca-clover-cron-secret":"synthetic-test-only"},
      });
      assert.equal(response.status,410,`${entry.path} must reject ${method}`);
      const body=await response.json();
      assert.equal(body.ok,false);
      assert.equal(body.code,entry.code);
    }
    console.log("PASS: retired live Deno Edge handler rejects GET/POST/OPTIONS with 410:",entry.path);
  }finally{
    child.kill("SIGTERM");
    if(child.exitCode===null&&child.signalCode===null){
      await Promise.race([once(child,"exit"),delay(1500)]);
    }
    if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");
  }
}
for(const entry of cases)await check(entry);
console.log("Retired CA-master independent Edge writer: live handler HTTP tests PASS");
