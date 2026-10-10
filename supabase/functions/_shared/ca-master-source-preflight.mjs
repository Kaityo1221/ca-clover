/**
 * Fail closed BEFORE any CA/Community metadata writes.
 * The CA master is a public CSV, not an authoritative deletion instruction
 * until every linked Community can be resolved without ambiguity.
 * Pure function usable in Deno and Node. No credentials or user data kept.
 */
export function assessCaMasterSource(records,{unresolvedCount,conflictCount}){
  if(!Array.isArray(records)||records.length===0){
    return {ok:false,reason:"EMPTY_MASTER",records:0,uniqueCaRecords:0};
  }
  if(!Number.isSafeInteger(unresolvedCount)||!Number.isSafeInteger(conflictCount)||
     unresolvedCount<0||conflictCount<0){
    return {ok:false,reason:"INVALID_PREFLIGHT_COUNTS",records:records.length,uniqueCaRecords:0};
  }
  if(unresolvedCount>0){
    return {ok:false,reason:"UNRESOLVED_CAMPFIRE_COMMUNITY",records:records.length,uniqueCaRecords:0};
  }
  if(conflictCount>0){
    return {ok:false,reason:"AMBIGUOUS_COMMUNITY_MAPPING",records:records.length,uniqueCaRecords:0};
  }
  const unique=new Map();
  for(const record of records){
    if(!record?.sourceKey||!record?.communityId ||
       !["1st","2nd"].includes(record.caLevel) ||
       !["active","inactive"].includes(record.status)){
      return {ok:false,reason:"INVALID_CA_RECORD",records:records.length,uniqueCaRecords:0};
    }
    // A CA may appear in multiple Communities, but every repeated row must
    // describe an identical CA master record (except Community fields).
    // Never send duplicate onConflict source_key values to PostgREST.
    const row={
      source_key:record.sourceKey,
      trainer_name:record.trainerName,
      ca_level:record.caLevel,
      prefecture:record.prefecture,
      join_date:record.joinDate,
      status:record.status,
      latitude:record.latitude,
      longitude:record.longitude,
    };
    const previous=unique.get(row.source_key);
    if(previous){
      if(JSON.stringify(previous)!==JSON.stringify(row)){
        return {ok:false,reason:"INCONSISTENT_DUPLICATE_CA",records:records.length,uniqueCaRecords:0};
      }
      continue;
    }
    unique.set(row.source_key,row);
  }
  return {ok:true,reason:null,records:records.length,
    uniqueCaRecords:unique.size,caRows:Array.from(unique.values())};
}
