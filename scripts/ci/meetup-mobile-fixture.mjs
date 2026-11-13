// Entire real Pages UI, synthetic identities/data only. No production network or write.
export const actor='00000000-0000-0000-0000-000000000090';
export const community='00000000-0000-0000-0000-000000000091';
export const meetupId=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export const csv='\uFEFF"username","display_name","rsvp_status"\r\n"sample","合成参加者","CHECKED_IN"\r\n';
export function fixtureSetup({role='ca',d=true,own=true}={}){return `
window.__fixture={role:${JSON.stringify(role)},d:${JSON.stringify(d)},own:${JSON.stringify(own)},calls:[],status:200,stopAfter:null};
const actor=${JSON.stringify(actor)},community=${JSON.stringify(community)};
const claims={sub:actor,session_id:'00000000-0000-0000-0000-000000000099'};
const session={user:{id:actor,email:'sample@example.invalid'},access_token:'synthetic.'+btoa(JSON.stringify(claims))+'.synthetic'};
const titles=['キョダイマックスエースバーンに挑戦！','ダイマックスラプラス討伐会！','キョダイマックスゲンガーチャレンジ！','コミュニティ・デイ','レイドデイ','スポライ','レイドアワー','みんなで散歩'];
const rows=Array.from({length:120},(_,i)=>({id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),title:titles[i%titles.length],starts_at:new Date(Date.UTC(2026,9,3-i,4,45)).toISOString(),ends_at:new Date(Date.UTC(2026,9,3-i,6)).toISOString(),location:'合成会場 イベント広場（プレビュー）',details:'合成データによる概要です。',is_ca_meetup:true,rsvp_count:47+i,checkin_count:29+i,campfire_live_event_name:i===0?'Gigantamax Cinderace Max Battle Day':null,is_passcode_reward_eligible:i===0}));
const future={...rows[0],id:'00000000-0000-0000-0000-000000000150',title:'今後の合成Meetup',starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-01-01T03:00:00Z'};
const fixture={communities:[{id:community,name:'Pokémon GO Club Tokyo（合成プレビュー）',prefecture:'東京都',member_count:100,coverage:'complete'}],community_ca_members:[],ca_members:[],community_member_snapshots:[],community_access_requests:[]};
const client={auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),onAuthStateChange(cb){window.__authChange=cb;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null})},
from(table){let filters=[],take=null,range=null;const q={select(){return q},eq(k,v){filters.push(['eq',k,v]);return q},in(){return q},order(){return q},limit(n){take=n;return q},range(a,b){range=[a,b];return q},gte(k,v){filters.push(['gte',k,v]);return q},lte(k,v){filters.push(['lte',k,v]);return q},gt(k,v){filters.push(['gt',k,v]);return q},
then(ok,bad){let data=table==='profiles'?[{role:window.__fixture.role,niantic_id:'合成CA'}]:table==='user_permissions'?(window.__fixture.d?[{permission_code:'D'}]:[]):table==='community_memberships'?(window.__fixture.own?[{community_id:community}]:[]):table==='meetups'?[...rows,future]:fixture[table]||[];
if(table==='meetups'){data=data.filter(row=>filters.every(([op,k,v])=>op==='eq'?row[k]===v||k==='community_id':op==='lte'?row[k]<=v:op==='gt'?row[k]>v:true));}
const count=data.length;if(range)data=data.slice(range[0],range[1]+1);if(take!==null)data=data.slice(0,take);return Promise.resolve({data,count,error:null}).then(ok,bad)},async maybeSingle(){const r=await q;return {...r,data:r.data[0]||null}}};return q;},
rpc:async()=>({data:[],error:null}),functions:{invoke:async()=>({data:{},error:null})}};
window.supabase={createClient:()=>client};
const originalFetch=window.fetch.bind(window);
window.fetch=async function(url,options){
const target=String(url);
if(target==='https://fixture.invalid/batch'){
 const body=JSON.parse(options.body);window.__fixture.calls.push(body);
 if(window.__fixture.status!==200)return new Response('{}',{status:window.__fixture.status,headers:{'content-type':'application/json'}});
 const subset=body.meetupIds.slice(body.offset,body.offset+10),limit=window.__fixture.stopAfter;
 const chosen=limit===null?subset:subset.slice(0,limit),files=chosen.map(meetupId=>({meetupId,csv:${JSON.stringify(csv)},bytes:new TextEncoder().encode(${JSON.stringify(csv)}).length,count:1}));
 return new Response(JSON.stringify({version:1,files,next:body.offset+files.length,complete:body.offset+files.length===body.meetupIds.length,stop:limit===null?null:{status:429,code:'RATE_LIMITED',retryAfter:3600}}),{headers:{'content-type':'application/json'}});
}
if(target.includes('supabase.co')){if(target.endsWith('/functions/v1/meetup-roster'))return new Response(${JSON.stringify(csv)},{headers:{'content-type':'text/csv','x-ca-clover-roster-count':'1'}});throw Error('Production network disabled in preview');}
return originalFetch(url,options);
};
`;
}
