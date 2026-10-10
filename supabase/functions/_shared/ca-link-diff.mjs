// Pure, side-effect-free reconciliation shared by Supabase master sync and CI.
// Never delete a link that a verified user_ca_identity still references.
export function partitionCaLinks(existingLinks,desiredLinks,verifiedIdentities){
  const key=row=>String(row.community_id)+"|"+String(row.ca_member_id);
  const desired=new Set(desiredLinks.map(key));
  const verified=new Set(verifiedIdentities.map(key));
  const protectedStaleLinks=[];
  const removableIds=[];
  for(const row of existingLinks){
    const k=key(row);
    if(desired.has(k)) continue;
    if(verified.has(k)){
      protectedStaleLinks.push({community_id:row.community_id,ca_member_id:row.ca_member_id});
    }else{
      removableIds.push(row.id);
    }
  }
  return {protectedStaleLinks,removableIds};
}
