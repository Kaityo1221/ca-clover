/**
 * Fail closed BEFORE any CA/Community metadata writes.
 * The CA master is a public CSV, not an authoritative deletion instruction
 * until every linked Community can be resolved without ambiguity.
 * Pure function usable in Deno and Node. No credentials or user data kept.
 */
export function assessCaMasterSource(records,{unresolvedCount,conflictCount,inputRowCount=records?.length}){
  if(!Array.isArray(records)||records.length===0){
    return {ok:false,reason:"EMPTY_MASTER",records:0,uniqueCaRecords:0};
  }
  if(!Number.isSafeInteger(inputRowCount) || inputRowCount!==records.length){
    return {ok:false,reason:"SKIPPED_OR_MALFORMED_SOURCE_ROWS",records:records.length,uniqueCaRecords:0};
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
    // Only the validated coordinate RPC may write coordinates. Metadata
    // UPSERT must not null-out coordinates when source values are missing.
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

/**
 * The baseline must be separately verified by an operator. Never derive it
 * from a preceding sync's success status or an approximate user count.
 */
export function assessCaMasterBaseline(baseline,sourceRows,uniqueCaRows){
  const baselineRows=baseline?.source_rows;
  const baselineCa=baseline?.unique_ca_members;
  if(baseline?.manually_verified!==true ||
     !Number.isSafeInteger(baselineRows)||baselineRows<=0 ||
     !Number.isSafeInteger(baselineCa)||baselineCa<=0){
    return {ok:false,reason:"MISSING_VERIFIED_BASELINE"};
  }
  if(!Number.isSafeInteger(sourceRows)||!Number.isSafeInteger(uniqueCaRows) ||
     sourceRows<=0||uniqueCaRows<=0 ||
     sourceRows<Math.ceil(baselineRows*0.9) ||
     uniqueCaRows<Math.ceil(baselineCa*0.9)){
    return {ok:false,reason:"SOURCE_COUNT_DROPPED"};
  }
  if(sourceRows>baselineRows*2){
    return {ok:false,reason:"SOURCE_COUNT_SPIKED"};
  }
  return {ok:true,reason:null};
}
