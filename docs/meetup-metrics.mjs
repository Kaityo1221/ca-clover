// Aggregate counts only, through the signed-in client's existing Community RLS.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
const time=v=>typeof v==='string'?Date.parse(v):NaN;
export async function applyLatestMetrics(client,communityId,rows,now=Date.now()){
  if(!uuid(communityId)||!Array.isArray(rows)||rows.length>120)return 0;
  const ids=[...new Set(rows.map(r=>r?.id).filter(uuid))];if(!ids.length)return 0;
  let result;
  try{result=await client.rpc('ca_clover_meetup_latest_metrics',{p_community_id:communityId,p_meetup_ids:ids});}catch{return 0;}
  if(result?.error||!Array.isArray(result?.data)||result.data.length>120)return 0;
  const allowed=new Set(ids),latest=new Map();
  for(const s of result.data){
    const at=time(s?.observed_at);
    if(!allowed.has(s?.meetup_id)||s.community_id!==communityId||!count(s.rsvp_count)||!count(s.checkin_count)||!Number.isFinite(at)||at>now)continue;
    if(at>(time(latest.get(s.meetup_id)?.observed_at)||-Infinity))latest.set(s.meetup_id,s);
  }
  let changed=0;
  for(const row of rows){
    const s=latest.get(row?.id);if(!s)continue;
    const base=time(row.fetched_at),at=time(s.observed_at);
    if(Number.isFinite(base)&&at<=base)continue;
    if(count(row.checkin_count)&&s.checkin_count<row.checkin_count)continue;
    row.rsvp_count=s.rsvp_count;row.checkin_count=s.checkin_count;row.metric_observed_at=s.observed_at;changed++;
  }
  return changed;
}
export function retainCardMetrics(detail,card){
  if(detail?.id!==card?.id||!Number.isFinite(time(card?.metric_observed_at)))return detail;
  const base=time(detail.fetched_at),at=time(card.metric_observed_at);
  if(Number.isFinite(base)&&base>at&&count(detail.checkin_count)&&detail.checkin_count>=card.checkin_count)return detail;
  return {...detail,rsvp_count:card.rsvp_count,checkin_count:card.checkin_count,metric_observed_at:card.metric_observed_at};
}
