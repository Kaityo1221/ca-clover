import type {SupabaseClient} from "npm:@supabase/supabase-js@2";

export type MeetupMetadataRow={
  campfire_meetup_id:string;
  is_passcode_reward_eligible:boolean|null;
};

const chunk=<T>(items:T[],size:number)=>{
  const result:T[][]=[];
  for(let index=0;index<items.length;index+=size) result.push(items.slice(index,index+size));
  return result;
};

export async function syncMeetupRewardEligibility(
  admin:SupabaseClient,
  rows:MeetupMetadataRow[],
){
  const observed=new Map<string,boolean>();
  for(const row of rows){
    if(typeof row.is_passcode_reward_eligible!=="boolean") continue;
    observed.set(row.campfire_meetup_id,row.is_passcode_reward_eligible);
  }
  if(observed.size===0) return {checked:0,updated:0};

  const ids=[...observed.keys()];
  const existing:Array<{
    campfire_meetup_id:string;
    is_passcode_reward_eligible:boolean|null;
  }>=[];

  for(const part of chunk(ids,200)){
    const {data,error}=await admin
      .from("meetups")
      .select("campfire_meetup_id,is_passcode_reward_eligible")
      .in("campfire_meetup_id",part);
    if(error) throw error;
    existing.push(...(data??[]));
  }

  const current=new Map(existing.map(row=>[
    row.campfire_meetup_id,
    row.is_passcode_reward_eligible,
  ]));
  const trueIds:string[]=[];
  const falseIds:string[]=[];

  for(const [id,value] of observed){
    if(current.get(id)===value) continue;
    (value?trueIds:falseIds).push(id);
  }

  for(const part of chunk(trueIds,200)){
    const {error}=await admin
      .from("meetups")
      .update({is_passcode_reward_eligible:true})
      .in("campfire_meetup_id",part);
    if(error) throw error;
  }
  for(const part of chunk(falseIds,200)){
    const {error}=await admin
      .from("meetups")
      .update({is_passcode_reward_eligible:false})
      .in("campfire_meetup_id",part);
    if(error) throw error;
  }

  return {
    checked:observed.size,
    updated:trueIds.length+falseIds.length,
  };
}
