import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CA_MASTER_URL="https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/export?format=csv&gid=1086182934";

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json"},
  });
}

function parseCsv(text:string){
  const rows:string[][]=[];
  let row:string[]=[];
  let cell="";
  let quoted=false;

  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){
      if(char==='"'){
        if(text[i+1]==='"'){
          cell+='"';
          i++;
        }else{
          quoted=false;
        }
      }else{
        cell+=char;
      }
      continue;
    }
    if(char==='"'){
      quoted=true;
      continue;
    }
    if(char===","){
      row.push(cell);
      cell="";
      continue;
    }
    if(char==="\n"){
      row.push(cell);
      rows.push(row);
      row=[];
      cell="";
      continue;
    }
    if(char!=="\r") cell+=char;
  }
  if(cell.length||row.length){
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(row=>row.some(cell=>cell.trim()));
}

function parseNumber(value:string|undefined){
  const number=Number.parseFloat((value??"").trim());
  return Number.isFinite(number)?number:null;
}

Deno.serve(async(req:Request)=>{
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey){
      return json({error:"Supabase environment is incomplete"},500);
    }

    const admin=createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false},
    });

    const suppliedSecret=req.headers.get(CRON_HEADER)??"";
    const {data:expectedSecret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(
      secretError ||
      typeof expectedSecret!=="string" ||
      !expectedSecret ||
      suppliedSecret!==expectedSecret
    ){
      return json({error:"unauthorized"},401);
    }

    const response=await fetch(CA_MASTER_URL,{
      headers:{"User-Agent":"CA-Clover/1.0"},
    });
    if(!response.ok){
      return json({error:`CA master fetch failed: HTTP ${response.status}`},502);
    }

    const rows=parseCsv(await response.text());
    if(rows.length<2) return json({error:"CA master CSV is empty"},502);

    const header=rows[0].map(value=>value.trim().toLowerCase());
    const nameIndex=header.indexOf("pgo trainer name");
    const latIndex=header.indexOf("lng 緯度");
    const lngIndex=header.indexOf("lat 経度");

    if(nameIndex<0||latIndex<0||lngIndex<0){
      return json({
        error:"CA master coordinate columns are missing",
        header,
      },502);
    }

    const payload=rows.slice(1).flatMap(row=>{
      const sourceKey=(row[nameIndex]??"").trim().toLowerCase();
      const latitude=parseNumber(row[latIndex]);
      const longitude=parseNumber(row[lngIndex]);
      if(!sourceKey||latitude===null||longitude===null) return [];
      if(latitude<-90||latitude>90||longitude<-180||longitude>180) return [];
      return [{source_key:sourceKey,latitude,longitude}];
    });

    const {data:result,error:updateError}=await admin.rpc(
      "internal_update_ca_master_coordinates",
      {p_rows:payload},
    );
    if(updateError) throw updateError;

    const nowIso=new Date().toISOString();
    const communityUpdated=Math.max(0,Number(result?.community_updated??0)||0);

    await admin.from("sync_automation_state").update({
      last_ca_master_at:nowIso,
      last_ca_master_updated:communityUpdated,
      updated_at:nowIso,
    }).eq("id",1);

    await admin.from("sync_runs").insert({
      source:"ca-master-coordinates",
      status:"success",
      finished_at:nowIso,
      details:{
        source_rows:rows.length-1,
        coordinate_rows:payload.length,
        ca_updated:Number(result?.ca_updated??0)||0,
        community_updated:communityUpdated,
      },
    });

    return json({
      ok:true,
      sourceRows:rows.length-1,
      coordinateRows:payload.length,
      caUpdated:Number(result?.ca_updated??0)||0,
      communityUpdated,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
