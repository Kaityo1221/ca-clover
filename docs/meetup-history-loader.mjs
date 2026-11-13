/**
 * Authenticated, read-only meetup history pager.
 * The "all" path requires an exact count and never silently renders truncated data.
 */
export async function loadMeetupHistory({client,communityId,fields,through,limit=25,scanAll=false,pageSize=200}) {
  if(!client||typeof client.from!=="function")throw new TypeError("client required");
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw new RangeError("invalid page size");
  if(!scanAll&&(!Number.isInteger(limit)||limit<1||limit>1000))throw new RangeError("invalid limit");
  const makeQuery=()=>{
    const q=client.from("meetups").select(fields,scanAll?{count:"exact"}:{})
      .eq("community_id",communityId).lte("starts_at",through)
      .order("starts_at",{ascending:false}).order("id",{ascending:false});
    return q;
  };
  const first=await (scanAll?makeQuery().range(0,pageSize-1):makeQuery().limit(limit));
  if(first.error)throw new Error("HISTORY_FETCH_FAILED");
  const collected=[...(first.data||[])];
  if(!scanAll)return collected;
  const total=first.count;
  if(!Number.isSafeInteger(total)||total<0||collected.length>total)throw new Error("HISTORY_COUNT_UNAVAILABLE");
  let offset=collected.length;
  for(let page=1;offset<total&&page<10000;page++){
    const next=await makeQuery().range(offset,offset+pageSize-1);
    if(next.error)throw new Error("HISTORY_FETCH_FAILED");
    const items=next.data||[];
    if(!items.length||items.length>pageSize)throw new Error("HISTORY_INCOMPLETE");
    collected.push(...items);
    offset+=items.length;
  }
  if(collected.length!==total)throw new Error("HISTORY_INCOMPLETE");
  const ids=new Set();
  for(const item of collected){
    if(typeof item?.id!=="string"||ids.has(item.id))throw new Error("HISTORY_DUPLICATE");
    ids.add(item.id);
  }
  return collected;
}
