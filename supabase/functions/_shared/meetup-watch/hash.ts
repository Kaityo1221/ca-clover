export type MeetupHashInput={
  title:string;
  details?:string|null;
  starts_at?:string|null;
  ends_at?:string|null;
  location?:string|null;
  is_ca_meetup?:boolean|null;
  campfire_live_event_name?:string|null;
  rsvp_count?:number|null;
  checkin_count?:number|null;
};

const SEP="\u001f";
const NULL_TOKEN="∅";

function cleanText(value:string|null|undefined){
  return value==null?NULL_TOKEN:String(value).replaceAll(SEP," ");
}

function cleanTime(value:string|null|undefined){
  if(!value) return NULL_TOKEN;
  const time=new Date(value);
  return Number.isFinite(time.getTime())?time.toISOString():NULL_TOKEN;
}

function cleanBool(value:boolean|null|undefined){
  return value==null?NULL_TOKEN:value?"true":"false";
}

function cleanNumber(value:number|null|undefined){
  return Number.isFinite(value)?String(value):NULL_TOKEN;
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

export async function buildMeetupHashes(row:MeetupHashInput){
  const structure=[
    cleanText(row.title),
    cleanText(row.details),
    cleanTime(row.starts_at),
    cleanTime(row.ends_at),
    cleanText(row.location),
    cleanBool(row.is_ca_meetup),
    cleanText(row.campfire_live_event_name),
  ].join(SEP);

  const activity=[
    cleanNumber(row.rsvp_count),
    cleanNumber(row.checkin_count),
  ].join(SEP);

  const [structure_hash,activity_hash]=await Promise.all([
    sha256(structure),
    sha256(activity),
  ]);

  return {structure_hash,activity_hash};
}
