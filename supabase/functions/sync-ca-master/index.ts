import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CA_MASTER_URL="https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/export?format=csv&gid=1086182934";

type MasterRecord={
  sourceKey:string;
  trainerName:string;
  caLevel:"1st"|"2nd";
  communityName:string;
  campfireUrl:string;
  communityId:string|null;
  prefecture:string;
  joinDate:string|null;
  status:string;
  latitude:number|null;
  longitude:number|null;
};

type CommunityRow={
  id:string;
  campfire_community_id:string|null;
  name:string;
  prefecture:string|null;
  campfire_url:string|null;
};

type HistoryRow={
  community_id:string;
  campfire_community_id:string;
  status:"active"|"retired";
};

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

function findHeader(header:string[],names:string[]){
  for(const name of names){
    const index=header.indexOf(name);
    if(index>=0) return index;
  }
  return -1;
}

function parseNumber(value:string|undefined){
  const number=Number.parseFloat((value??"").trim());
  return Number.isFinite(number)?number:null;
}

function normalizeDate(value:string){
  const raw=value.trim();
  if(!raw) return null;
  const ymd=raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if(ymd) return `${ymd[1]}-${ymd[2].padStart(2,"0")}-${ymd[3].padStart(2,"0")}`;
  const mdy=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  return null;
}

function normalizeStatus(value:string){
  const raw=value.normalize("NFKC").trim().toLowerCase();
  if(/inactive|retired|suspended|休止|停止|卒業|退任|終了/.test(raw)) return "inactive";
  return "active";
}

function extractCommunityId(campfireUrl:string){
  try{
    const url=new URL(campfireUrl);
    const directId=url.searchParams.get("clubId");
    if(directId&&/^[0-9a-f-]{36}$/i.test(directId)) return directId;

    const encoded=url.searchParams.get("deep_link_sub1");
    if(!encoded) return null;

    const normalized=encoded.replace(/-/g,"+").replace(/_/g,"/");
    const padded=normalized+"=".repeat((4-(normalized.length%4))%4);
    const decoded=atob(padded);
    const params=new URLSearchParams(decoded);
    const id=params.get("c");
    return id&&/^[0-9a-f-]{36}$/i.test(id)?id:null;
  }catch{
    return null;
  }
}

function parseMaster(csv:string):MasterRecord[]{
  const rows=parseCsv(csv);
  if(rows.length<2) return [];

  const header=rows[0].map(value=>value.trim().toLowerCase());
  const index={
    name:header.indexOf("pgo trainer name"),
    second:header.indexOf("2nd ca"),
    group:header.indexOf("campfire group name"),
    url:header.indexOf("campfire url"),
    city:header.indexOf("primary city"),
    date:header.indexOf("ca join date"),
    status:findHeader(header,["status","ステータス","状態"]),
    lat:findHeader(header,["lng 緯度","lat 緯度","緯度","latitude","lat"]),
    lng:findHeader(header,["lat 経度","lng 経度","経度","longitude","lng"]),
  };

  if(index.name<0||index.group<0||index.city<0){
    throw new Error("CA master required columns are missing");
  }

  return rows.slice(1).flatMap(row=>{
    const trainerName=(row[index.name]??"").trim();
    const communityName=(row[index.group]??"").trim();
    const city=(row[index.city]??"").trim();
    const prefecture=city.match(/^\d{2}_(.+)$/)?.[1]??city;
    if(!trainerName||!communityName||!prefecture) return [];

    const campfireUrl=index.url>=0?(row[index.url]??"").trim():"";
    const rawStatus=index.status>=0?(row[index.status]??"").trim():"";
    const second=index.second>=0?(row[index.second]??"").trim():"";

    return [{
      sourceKey:trainerName.toLowerCase(),
      trainerName,
      caLevel:second?"2nd":"1st",
      communityName,
      campfireUrl,
      communityId:extractCommunityId(campfireUrl),
      prefecture,
      joinDate:index.date>=0?normalizeDate(row[index.date]??""):null,
      status:normalizeStatus(rawStatus),
      latitude:index.lat>=0?parseNumber(row[index.lat]):null,
      longitude:index.lng>=0?parseNumber(row[index.lng]):null,
    }];
  });
}

function communityIdentity(prefecture:string,communityName:string){
  return `${prefecture}\u0000${communityName}`;
}

function displayCommunityIdentity(identity:string){
  const [prefecture,communityName]=identity.split("\u0000");
  return {prefecture,community_name:communityName};
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

    const records=parseMaster(await response.text());
    const resolved=records.filter(
      (record):record is MasterRecord&{communityId:string}=>Boolean(record.communityId),
    );
    const unresolved=records.filter(record=>!record.communityId);

    const idToIdentities=new Map<string,Set<string>>();
    const identityToIds=new Map<string,Set<string>>();

    for(const record of resolved){
      const identity=communityIdentity(record.prefecture,record.communityName);
      const identities=idToIdentities.get(record.communityId)??new Set<string>();
      identities.add(identity);
      idToIdentities.set(record.communityId,identities);

      const ids=identityToIds.get(identity)??new Set<string>();
      ids.add(record.communityId);
      identityToIds.set(identity,ids);
    }

    const conflictingCommunityIds=new Set(
      Array.from(idToIdentities.entries())
        .filter(([,identities])=>identities.size>1)
        .map(([communityId])=>communityId),
    );

    const conflictingIdentities=new Set(
      Array.from(identityToIds.entries())
        .filter(([,ids])=>ids.size>1)
        .map(([identity])=>identity),
    );

    const conflictRecords=resolved.filter(record=>{
      const identity=communityIdentity(record.prefecture,record.communityName);
      return conflictingCommunityIds.has(record.communityId)||conflictingIdentities.has(identity);
    });

    const safeResolved=resolved.filter(record=>{
      const identity=communityIdentity(record.prefecture,record.communityName);
      return !conflictingCommunityIds.has(record.communityId)&&!conflictingIdentities.has(identity);
    });

    const conflicts:Array<Record<string,unknown>>=[
      ...Array.from(conflictingCommunityIds).map(communityId=>({
        type:"community_id_shared_by_multiple_names",
        community_id:communityId,
        communities:Array.from(idToIdentities.get(communityId)??[]).map(displayCommunityIdentity),
        source_keys:resolved
          .filter(record=>record.communityId===communityId)
          .map(record=>record.sourceKey),
      })),
      ...Array.from(conflictingIdentities).map(identity=>({
        type:"community_name_has_multiple_ids",
        ...displayCommunityIdentity(identity),
        community_ids:Array.from(identityToIds.get(identity)??[]),
        source_keys:resolved
          .filter(record=>communityIdentity(record.prefecture,record.communityName)===identity)
          .map(record=>record.sourceKey),
      })),
    ];

    const caRows=records.map(record=>({
      source_key:record.sourceKey,
      trainer_name:record.trainerName,
      ca_level:record.caLevel,
      prefecture:record.prefecture,
      join_date:record.joinDate,
      status:record.status,
      latitude:record.latitude,
      longitude:record.longitude,
    }));

    if(caRows.length){
      const {error:caError}=await admin
        .from("ca_members")
        .upsert(caRows,{onConflict:"source_key"});
      if(caError) throw caError;
    }

    const [
      {data:existingCommunities,error:communitiesError},
      {data:historyRows,error:historyError},
    ]=await Promise.all([
      admin.from("communities")
        .select("id,campfire_community_id,name,prefecture,campfire_url"),
      admin.from("community_campfire_ids")
        .select("community_id,campfire_community_id,status"),
    ]);
    if(communitiesError) throw communitiesError;
    if(historyError) throw historyError;

    const communities=(existingCommunities??[]) as CommunityRow[];
    const history=(historyRows??[]) as HistoryRow[];

    const currentByCampfireId=new Map(
      communities
        .filter(row=>row.campfire_community_id)
        .map(row=>[String(row.campfire_community_id),row]),
    );
    const historyByCampfireId=new Map(
      history.map(row=>[row.campfire_community_id,row]),
    );
    const communitiesById=new Map(communities.map(row=>[row.id,row]));
    const communitiesByIdentity=new Map<string,CommunityRow[]>();

    for(const row of communities){
      const identity=communityIdentity(row.prefecture??"",row.name);
      const list=communitiesByIdentity.get(identity)??[];
      list.push(row);
      communitiesByIdentity.set(identity,list);
    }

    const sourceCommunityMap=new Map<string,string>();
    const uniqueSourceRecords=Array.from(
      new Map(safeResolved.map(record=>[record.communityId,record])).values(),
    );

    const createRows:Array<{
      campfire_community_id:string;
      name:string;
      prefecture:string;
      campfire_url:string|null;
      latitude:number|null;
      longitude:number|null;
      fetched_at:string;
    }>=[];

    for(const record of uniqueSourceRecords){
      const current=currentByCampfireId.get(record.communityId);
      if(current){
        sourceCommunityMap.set(record.communityId,current.id);
        continue;
      }

      const historical=historyByCampfireId.get(record.communityId);
      if(historical){
        sourceCommunityMap.set(record.communityId,historical.community_id);
        continue;
      }

      const identity=communityIdentity(record.prefecture,record.communityName);
      const identityMatches=communitiesByIdentity.get(identity)??[];

      if(identityMatches.length===1){
        sourceCommunityMap.set(record.communityId,identityMatches[0].id);
        continue;
      }

      if(identityMatches.length>1){
        conflicts.push({
          type:"database_identity_ambiguous",
          community_id:record.communityId,
          community_name:record.communityName,
          prefecture:record.prefecture,
          community_candidates:identityMatches.map(row=>row.id),
          source_keys:safeResolved
            .filter(row=>row.communityId===record.communityId)
            .map(row=>row.sourceKey),
        });
        continue;
      }

      createRows.push({
        campfire_community_id:record.communityId,
        name:record.communityName,
        prefecture:record.prefecture,
        campfire_url:record.campfireUrl||null,
        latitude:record.latitude,
        longitude:record.longitude,
        fetched_at:new Date().toISOString(),
      });
    }

    if(createRows.length){
      const {data:created,error:createError}=await admin
        .from("communities")
        .upsert(createRows,{onConflict:"campfire_community_id"})
        .select("id,campfire_community_id,name,prefecture,campfire_url");
      if(createError) throw createError;

      for(const row of (created??[]) as CommunityRow[]){
        if(!row.campfire_community_id) continue;
        sourceCommunityMap.set(row.campfire_community_id,row.id);
        communitiesById.set(row.id,row);
      }

      const activeHistoryRows=(created??[])
        .filter(row=>row.campfire_community_id)
        .map(row=>({
          community_id:row.id,
          campfire_community_id:row.campfire_community_id,
          status:"active",
          source:"ca-master-new",
          observed_name:row.name,
          last_seen_at:new Date().toISOString(),
          retired_at:null,
        }));

      if(activeHistoryRows.length){
        const {error:activeHistoryError}=await admin
          .from("community_campfire_ids")
          .upsert(activeHistoryRows,{onConflict:"campfire_community_id"});
        if(activeHistoryError) throw activeHistoryError;
      }
    }

    const metadataUpdates=new Map<string,{
      name:string;
      prefecture:string;
      latitude:number|null;
      longitude:number|null;
      fetched_at:string;
      campfire_url?:string|null;
    }>();

    const retiredHistoryRows:Array<{
      community_id:string;
      campfire_community_id:string;
      status:"retired";
      source:string;
      observed_name:string;
      last_seen_at:string;
      retired_at:string;
    }>=[];

    for(const record of uniqueSourceRecords){
      const targetId=sourceCommunityMap.get(record.communityId);
      if(!targetId) continue;

      const target=communitiesById.get(targetId)??communities.find(row=>row.id===targetId)??null;
      const update:{
        name:string;
        prefecture:string;
        latitude:number|null;
        longitude:number|null;
        fetched_at:string;
        campfire_url?:string|null;
      }={
        name:record.communityName,
        prefecture:record.prefecture,
        latitude:record.latitude,
        longitude:record.longitude,
        fetched_at:new Date().toISOString(),
      };

      if(target?.campfire_community_id===record.communityId){
        update.campfire_url=record.campfireUrl||null;
      }
      metadataUpdates.set(targetId,update);

      if(
        target?.campfire_community_id &&
        target.campfire_community_id!==record.communityId &&
        !historyByCampfireId.has(record.communityId)
      ){
        retiredHistoryRows.push({
          community_id:targetId,
          campfire_community_id:record.communityId,
          status:"retired",
          source:"ca-master-observed",
          observed_name:record.communityName,
          last_seen_at:new Date().toISOString(),
          retired_at:new Date().toISOString(),
        });
      }
    }

    for(const [communityId,update] of metadataUpdates){
      const {error:updateError}=await admin
        .from("communities")
        .update(update)
        .eq("id",communityId);
      if(updateError) throw updateError;
    }

    if(retiredHistoryRows.length){
      const {error:retiredHistoryError}=await admin
        .from("community_campfire_ids")
        .insert(retiredHistoryRows);
      if(retiredHistoryError) throw retiredHistoryError;
    }

    const sourceKeys=caRows.map(row=>row.source_key);
    const {data:caMembers,error:caSelectError}=sourceKeys.length
      ?await admin.from("ca_members").select("id,source_key").in("source_key",sourceKeys)
      :{data:[],error:null};
    if(caSelectError) throw caSelectError;

    const caMap=new Map((caMembers??[]).map(row=>[row.source_key,row.id]));
    const blockedSourceKeys=new Set([
      ...unresolved.map(record=>record.sourceKey),
      ...conflictRecords.map(record=>record.sourceKey),
      ...conflicts.flatMap(conflict=>
        Array.isArray(conflict.source_keys)
          ?conflict.source_keys.map(value=>String(value))
          :[],
      ),
    ]);

    const managedSourceKeys=new Set(
      safeResolved
        .map(record=>record.sourceKey)
        .filter(sourceKey=>!blockedSourceKeys.has(sourceKey)),
    );

    const managedCaIds=(caMembers??[])
      .filter(row=>managedSourceKeys.has(row.source_key))
      .map(row=>row.id);

    if(managedCaIds.length){
      const {error:deleteLinkError}=await admin
        .from("community_ca_members")
        .delete()
        .in("ca_member_id",managedCaIds);
      if(deleteLinkError) throw deleteLinkError;
    }

    const links=safeResolved.flatMap(record=>{
      if(blockedSourceKeys.has(record.sourceKey)) return [];
      const communityId=sourceCommunityMap.get(record.communityId);
      const caMemberId=caMap.get(record.sourceKey);
      if(!communityId||!caMemberId) return [];
      return [{community_id:communityId,ca_member_id:caMemberId}];
    });

    if(links.length){
      const {error:linkError}=await admin
        .from("community_ca_members")
        .upsert(links,{onConflict:"community_id,ca_member_id"});
      if(linkError) throw linkError;
    }

    const coordinatePayload=records.flatMap(record=>
      record.latitude!==null&&record.longitude!==null
        ?[{source_key:record.sourceKey,latitude:record.latitude,longitude:record.longitude}]
        :[],
    );
    const {data:coordinateResult,error:coordinateError}=await admin.rpc(
      "internal_update_ca_master_coordinates",
      {p_rows:coordinatePayload},
    );
    if(coordinateError) throw coordinateError;

    const isPartial=unresolved.length>0||conflicts.length>0;
    const finishedAt=new Date().toISOString();

    const details={
      source_rows:records.length,
      resolved_rows:resolved.length,
      safe_resolved_rows:safeResolved.length,
      unresolved_rows:unresolved.length,
      conflict_rows:conflictRecords.length,
      conflicts,
      communities_created:createRows.length,
      source_community_ids_mapped:sourceCommunityMap.size,
      historical_ids_recorded:retiredHistoryRows.length,
      ca_members:caRows.length,
      links:links.length,
      coordinates:{
        ca_updated:Number(coordinateResult?.ca_updated??0)||0,
        community_updated:Number(coordinateResult?.community_updated??0)||0,
      },
    };

    await admin.from("sync_runs").insert({
      source:"ca_members_map",
      status:isPartial?"partial":"success",
      finished_at:finishedAt,
      details,
    });

    await admin.from("sync_automation_state").update({
      last_ca_master_at:finishedAt,
      last_ca_master_updated:createRows.length,
      updated_at:finishedAt,
    }).eq("id",1);

    return json({
      ok:true,
      status:isPartial?"partial":"success",
      sourceRows:records.length,
      resolvedRows:resolved.length,
      safeResolvedRows:safeResolved.length,
      unresolvedRows:unresolved.length,
      conflictRows:conflictRecords.length,
      conflicts,
      communitiesCreated:createRows.length,
      sourceCommunityIdsMapped:sourceCommunityMap.size,
      historicalIdsRecorded:retiredHistoryRows.length,
      caMembers:caRows.length,
      links:links.length,
      coordinateResult,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
