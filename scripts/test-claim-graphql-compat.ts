// Regression: the deployed community-claim v14 used the Event query without
// isPasscodeRewardEligible. Never query real Campfire: mocked fetch only.
import {CampfireClient} from "../supabase/functions/_shared/campfire/client.ts";
import {EVENT_QUERY,PUBLIC_ACTIVITY_EVENT_QUERY}
  from "../supabase/functions/_shared/campfire/queries.ts";

const id="00000000-0000-4000-8000-000000000001";
const normalize=(query:string)=>query.replace(/\s+/g," ").trim();
const legacyQuery=`query CA_Clover_Event($id: ID!) {
  event(id: $id) {
    id
    name
    details
    createdAt
    clubId
    club { id name }
    address
    location
    eventTime
    eventEndTime
    createdByCommunityAmbassador
    creator {
      displayName
      username
      badges { badgeType alias }
    }
    checkedInMembersCount
    members(first: 1) { totalCount }
    campfireLiveEvent { eventName }
  }
}`;
const snapshots: Array<{query:string,variables:Record<string,unknown>,headers:Headers}>=[];
const fetchStub:typeof fetch=async (_url,init)=>{
  const body=JSON.parse(String(init?.body??"{}"));
  snapshots.push({
    query:String(body.query),
    variables:body.variables,
    headers:new Headers(init?.headers),
  });
  return new Response(JSON.stringify({data:{event:{id,name:"Synthetic Meetup"}}}),{
    status:200,headers:{"Content-Type":"application/json"},
  });
};
function expect(value:boolean,message:string){
  if(!value) throw new Error(message);
}
Deno.test("Community claim uses precisely deployed v14 Event fields",async()=>{
  snapshots.length=0;
  const client=new CampfireClient({fetchImpl:fetchStub,minRequestIntervalMs:0,maxRetries:1});
  const event=await client.getAnonymousClaimEvent(id);
  expect(event.id===id,"Mocked event must be returned");
  expect(snapshots.length===1,"Exactly one request");
  expect(normalize(snapshots[0].query)===normalize(legacyQuery),
    "Claim query must equal deployed v14 Event field set");
  expect(!snapshots[0].query.includes("isPasscodeRewardEligible"),
    "Do not inject unverified GraphQL fields into Community claims");
  expect(snapshots[0].variables.id===id,"Event ID preserved");
  expect(!snapshots[0].headers.has("authorization"),
    "Anonymous Meetup verification must never send bearer credentials");
});

Deno.test("Regular Meetup feed/Event queries retain existing new fields",async()=>{
  snapshots.length=0;
  expect(EVENT_QUERY.includes("isPasscodeRewardEligible"),
    "General Event query must not regress");
  expect(PUBLIC_ACTIVITY_EVENT_QUERY.includes("isPasscodeRewardEligible"),
    "Public Activity query must not regress");
  const client=new CampfireClient({fetchImpl:fetchStub,minRequestIntervalMs:0,maxRetries:1});
  await client.getAnonymousEvent(id);
  expect(snapshots.length===1,"General Event request expected");
  expect(normalize(snapshots[0].query)===normalize(EVENT_QUERY),
    "Ordinary Meetup fetch must use original query");
});

Deno.test("Public activity query path remains independent",async()=>{
  snapshots.length=0;
  const client=new CampfireClient({fetchImpl:fetchStub,minRequestIntervalMs:0,maxRetries:1});
  await client.getAnonymousActivityEvent(id);
  expect(snapshots.length===1,"Activity query request expected");
  expect(normalize(snapshots[0].query)===normalize(PUBLIC_ACTIVITY_EVENT_QUERY),
    "Activity query must be unaffected by Community claims");
});
