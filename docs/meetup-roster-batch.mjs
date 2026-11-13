import {createRosterZip,rosterFilename} from './meetup-roster-zip.mjs';
import {acquireExport,releaseExport,nextExportAt,noteExportAttempt} from './meetup-export-lock.mjs';
export const CSV_BYTE_LIMIT=8000000;
export const BATCH_MEMORY_TTL=70*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readBatchJson(response,signal){
  if(!response.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_RESPONSE');
  const reader=response.body?.getReader();if(!reader)throw Error('INVALID_RESPONSE');
  const chunks=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{for(;;){signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;
    size+=value.length;if(size>16100000)throw Error('BYTE_LIMIT');chunks.push(value);
  }}finally{signal.removeEventListener('abort',cancel);cancel();reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export class RosterBatch {
  constructor({meetups,userId,sessionId,endpoint,authorize,fetcher=fetch,now=Date.now,onProgress=()=>{}}){
    if(!Array.isArray(meetups)||meetups.length<1||meetups.length>20||meetups.some(m=>!UUID.test(m.id||''))||
      new Set(meetups.map(m=>m.id.toLowerCase())).size!==meetups.length)throw Error('INVALID_SELECTION');
    if(new URL(endpoint).protocol!=='https:')throw Error('INVALID_ENDPOINT');
    Object.assign(this,{meetups,userId,sessionId,endpoint,authorize,fetcher,now,onProgress});
    this.files=[];this.bytes=0;this.retryAt=0;this.expiresAt=now()+BATCH_MEMORY_TTL;this.busy=false;this.destroyed=false;
  }
  async identity(){
    if(this.destroyed||this.now()>=this.expiresAt){this.destroy();throw Error('EXPIRED');}
    let identity;
    try{identity=await this.authorize();}catch{this.destroy();throw Error('FORBIDDEN');}
    if(this.destroyed||identity?.userId!==this.userId||identity?.sessionId!==this.sessionId){this.destroy();throw Error('FORBIDDEN');}
    return identity;
  }
  async run(){
    if(this.busy)throw Error('BUSY');await this.identity();
    if(this.now()<Math.max(this.retryAt,nextExportAt()))throw Error('WAIT');
    if(!acquireExport(this))throw Error('BUSY');
    this.busy=true;this.controller=new AbortController();
    const signal=AbortSignal.any([this.controller.signal,AbortSignal.timeout(190000)]);
    try{
      // Exactly one stage per request; next stage starts only after its response and cooldown.
      const identity=await this.identity();
      const response=await this.fetcher(this.endpoint,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',redirect:'error',signal,
        headers:{authorization:'Bearer '+identity.accessToken,apikey:identity.publicKey,'content-type':'application/json'},
        body:JSON.stringify({meetupIds:this.meetups.map(m=>m.id),offset:this.files.length,remainingBytes:CSV_BYTE_LIMIT-this.bytes})});
      noteExportAttempt();
      if(response.status===401||response.status===403){void response.body?.cancel();this.destroy();throw Error('FORBIDDEN');}
      if(response.status===429){void response.body?.cancel();this.retryAt=this.now()+3600000;throw Error('RATE_LIMITED');}
      if(response.status!==200){void response.body?.cancel();throw Error('FETCH_FAILED');}
      const data=await readBatchJson(response,signal);await this.identity();signal.throwIfAborted();
      const start=this.files.length;
      if(data?.version!==1||!Array.isArray(data.files)||data.files.length>10||data.files.length>this.meetups.length-start||
        data.next!==start+data.files.length||data.complete!==(data.next===this.meetups.length)||
        (!data.stop&&data.files.length!==Math.min(10,this.meetups.length-start)))throw Error('INVALID_RESPONSE');
      // Validate whole response before committing any new files.
      let added=0;const pending=[];
      for(const [index,file] of data.files.entries()){
        if(file.meetupId!==this.meetups[start+index].id||typeof file.csv!=='string'||!Number.isInteger(file.count)||file.count<0||file.count>5000)throw Error('INVALID_RESPONSE');
        const bytes=new TextEncoder().encode(file.csv);
        if(file.bytes!==bytes.length||bytes.length<40)throw Error('INVALID_RESPONSE');
        added+=bytes.length;if(this.bytes+added>CSV_BYTE_LIMIT){this.destroy();throw Error('BYTE_LIMIT');}
        pending.push({name:rosterFilename(this.meetups[start+index]),bytes});
      }
      this.files.push(...pending);this.bytes+=added;this.onProgress(this);
      if(data.stop){
        if(data.stop.code==='BYTE_LIMIT'){this.destroy();throw Error('BYTE_LIMIT');}
        const wait=data.stop.status===429?Math.max(15,Math.min(3600,Number(data.stop.retryAfter)||3600)):15;
        this.retryAt=this.now()+wait*1000;
        throw Error(data.stop.status===429?'RATE_LIMITED':'FETCH_FAILED');
      }
      this.retryAt=this.now()+15000;
      return this.files.length===this.meetups.length;
    }catch(error){
      if(error.message==='BYTE_LIMIT')this.destroy();
      if(!this.destroyed)this.retryAt=Math.max(this.retryAt,this.now()+15000);
      throw error;
    }finally{this.busy=false;releaseExport(this);}
  }
  async zip(){await this.identity();if(this.busy||this.files.length!==this.meetups.length)throw Error('INCOMPLETE');return createRosterZip(this.files);}
  destroy(){this.destroyed=true;this.controller?.abort();this.files=[];this.bytes=0;}
}
