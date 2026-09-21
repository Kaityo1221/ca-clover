const UUID_RE=/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function uuid(value){
  return String(value??"").match(UUID_RE)?.[0]??null;
}

function decodeBase64Utf8(value){
  try{
    let normalized=String(value??"").trim().replace(/ /g,"+").replace(/-/g,"+").replace(/_/g,"/");
    while(normalized.length%4) normalized+="=";
    const binary=atob(normalized);
    const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{
    return null;
  }
}

function candidate(params,keys){
  for(const key of keys){
    const found=uuid(params.get(key));
    if(found) return found;
  }
  return null;
}

export function parseCampfireShareUrl(value){
  const raw=String(value??"").trim();
  let url;
  try{
    url=new URL(raw);
  }catch{
    return {kind:"invalid",reason:"URL形式ではありません"};
  }
  if(url.protocol!=="https:") return {kind:"invalid",reason:"https URLではありません"};

  const host=url.hostname.toLowerCase();

  if(host==="cmpf.re"){
    return {kind:"short",url:url.toString()};
  }

  if(host==="campfire.onelink.me"){
    const encoded=url.searchParams.get("deep_link_sub1");
    if(!encoded) return {kind:"invalid",reason:"Campfire共有情報を取得できません"};

    const decoded=decodeBase64Utf8(encoded);
    if(!decoded) return {kind:"invalid",reason:"Campfire共有情報を解析できません"};

    const params=new URLSearchParams(decoded);
    const route=(params.get("r")??"").toLowerCase();

    const eventId=candidate(params,[
      "e","event","eventId","event_id","m","meetup","meetupId","meetup_id",
    ]);
    if(eventId) return {kind:"meetup",id:eventId,url:url.toString(),decoded};

    const communityId=candidate(params,[
      "c","club","clubId","club_id","community","communityId","community_id",
    ]);

    if((route.includes("club")||route.includes("communit"))&&communityId){
      return {kind:"community",id:communityId,url:url.toString(),decoded};
    }

    const allUuids=[...decoded.matchAll(new RegExp(UUID_RE.source,"ig"))].map(match=>match[0]);
    const unique=[...new Set(allUuids.map(id=>id.toLowerCase()))];

    if(route.includes("event")||route.includes("meet")){
      const picked=eventId??allUuids[0]??null;
      if(picked) return {kind:"meetup",id:picked,url:url.toString(),decoded};
    }

    if(communityId){
      return {kind:"community",id:communityId,url:url.toString(),decoded};
    }

    if(unique.length===1){
      return {kind:"meetup",id:allUuids[0],url:url.toString(),decoded};
    }

    return {kind:"invalid",reason:"Campfire共有URLの対象を特定できません"};
  }

  if(host==="campfire.scopely.com"){
    const id=uuid(url.pathname)||uuid(url.search);
    if(!id) return {kind:"invalid",reason:"Campfire URLから対象IDを取得できません"};
    const path=url.pathname.toLowerCase();
    if(path.includes("meetup")||path.includes("event")){
      return {kind:"meetup",id,url:url.toString()};
    }
    if(path.includes("club")||path.includes("community")){
      return {kind:"community",id,url:url.toString()};
    }
    return {kind:"meetup",id,url:url.toString()};
  }

  return {kind:"invalid",reason:"対応していないCampfire URLです"};
}

export async function resolveCampfireShareUrl(value,{fetchImpl=fetch,maxRedirects=3}={}){
  let current=String(value??"").trim();

  for(let attempt=0;attempt<=maxRedirects;attempt++){
    const parsed=parseCampfireShareUrl(current);
    if(parsed.kind==="meetup"||parsed.kind==="community") return parsed;
    if(parsed.kind!=="short") return parsed;

    let response;
    try{
      response=await fetchImpl(parsed.url,{
        method:"GET",
        redirect:"follow",
        headers:{"User-Agent":"CA-Clover/1.0"},
      });
    }catch{
      return {kind:"invalid",reason:"Campfire共有URLを開けませんでした"};
    }

    const next=response?.url;
    if(!next||next===current){
      return {kind:"invalid",reason:"Campfire共有URLの遷移先を取得できません"};
    }
    current=next;
  }

  return {kind:"invalid",reason:"Campfire共有URLのリダイレクトが多すぎます"};
}
