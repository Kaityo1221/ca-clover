import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const html=readFileSync('docs/admin.html','utf8');
const source=html.slice(html.indexOf('async function meetupBackfill(){'),html.indexOf('\nasync function render(){',html.indexOf('async function meetupBackfill(){')));
const id='11111111-2222-4333-8444-555555555555',club='99999999-8888-4777-8666-555555555555',community='aaaaaaaa-2222-4333-8444-555555555555';
const event={id,clubId:club,title:'Synthetic',startsAt:'2026-10-24T06:00:00.000Z',endsAt:'2026-10-24T07:00:00.000Z',createdAt:'2026-10-24T04:37:00.000Z',countsComplete:true,rsvpCount:40,checkinCount:39,url:'https://campfire.scopely.com/discover/meetup/'+id};
async function mount(preview,apply){
 const nodes=Object.fromEntries(['backfillUrl','backfillPreviewBtn','backfillResult','backfillCommitBtn','backfillRetryBtn'].map(k=>[k,{value:'',innerHTML:'',disabled:false,onclick:null}]));
 const calls=[];
 const context=vm.createContext({app:{innerHTML:''},document:{getElementById:k=>nodes[k]},title:()=>'',msg:x=>x,e:String,fmt:String,URL,Date,Response,crypto:{randomUUID},confirm:()=>true,
 client:{functions:{invoke:async(name,{body})=>{calls.push(body);return body.action==='preview'?{data:preview}:apply(body,calls)}}}});
 vm.runInContext(source+';globalThis.mount=meetupBackfill;',context);await context.mount();
 nodes.backfillUrl.value=event.url;await nodes.backfillPreviewBtn.onclick();
 return {nodes,calls};
}
const preview={ok:true,status:'preview',event,community:{id:community,name:'Synthetic'},existing:'missing',checkedAt:new Date().toISOString(),readOnly:false,canSave:true,registrationContract:'atomic-audit-v1'};
for(const changes of [{canSave:false,readOnly:true},{registrationContract:'unknown'},{event:{...event,countsComplete:false}},{existing:'already_present'}]){
 const x=await mount({...preview,...changes},()=>{throw Error('must not save')});assert.equal(x.nodes.backfillCommitBtn.onclick,null);
}
let lost=true;
const x=await mount(preview,async body=>{
 if(lost){lost=false;return {error:new Error('response lost')}}
 return {data:{ok:true,outcome:'already_present',audited:true,registrationContract:'atomic-audit-v1',eventId:id,communityId:community,meetupId:randomUUID()}};
});
await x.nodes.backfillCommitBtn.onclick();assert.match(x.nodes.backfillResult.innerHTML,/再試行/);
await x.nodes.backfillRetryBtn.onclick();assert.equal(x.calls[1].requestId,x.calls[2].requestId);assert.match(x.nodes.backfillResult.innerHTML,/重複登録/);
const wrong=await mount(preview,async()=>({data:{ok:true,outcome:'created',audited:true,registrationContract:'atomic-audit-v1',eventId:randomUUID(),communityId:community,meetupId:randomUUID()}}));
await wrong.nodes.backfillCommitBtn.onclick();assert.match(wrong.nodes.backfillResult.innerHTML,/登録結果を確認できません/);
const edited=await mount(preview,()=>{throw Error('must not save')});edited.nodes.backfillUrl.value='https://cmpf.re/changed';await edited.nodes.backfillCommitBtn.onclick();assert.equal(edited.calls.length,1);
console.log('PASS UI contract gates, lost-response stable-ID retry, result identity and edited URL rejection (VM; not browser)');
