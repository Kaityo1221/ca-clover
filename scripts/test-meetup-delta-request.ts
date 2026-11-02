import assert from "node:assert/strict";
import {requestAuthorizedMeetupDeltas, MeetupDeltaRequestError} from "../src/lib/meetup-delta-request.ts";

const ids=["own-1","own-2"];
const successful=async(id:string)=>({data:{ok:true,communityId:id,added:id==="own-1"?2:0,updated:1,unchanged:4}});
const totals=await requestAuthorizedMeetupDeltas(ids,successful);
assert.deepEqual(totals,{added:2,updated:2,unchanged:8,checkedCommunities:2});
let calls=0;
await assert.rejects(requestAuthorizedMeetupDeltas(ids,async id=>{
 calls++;
 if(id==="own-2") return {data:null,error:{context:{status:403}}};
 return successful(id);
}),(err:unknown)=>err instanceof MeetupDeltaRequestError && err.category==="unauthorized");
assert.equal(calls,2);
await assert.rejects(requestAuthorizedMeetupDeltas(ids,async id=>{
 if(id==="own-2")throw Error("network");
 return successful(id);
}),(err:unknown)=>err instanceof MeetupDeltaRequestError && err.category==="unavailable");
await assert.rejects(requestAuthorizedMeetupDeltas(ids,async id=>({
 data:{ok:true,communityId:id==="own-1"?"foreign":id,added:1,updated:0,unchanged:0}
})),(err:unknown)=>err instanceof MeetupDeltaRequestError && err.category==="invalid-response");
await assert.rejects(requestAuthorizedMeetupDeltas(["own-1","own-1"],successful),/INVALID_RESPONSE/);
await assert.rejects(requestAuthorizedMeetupDeltas([],successful),/INVALID_RESPONSE/);
await assert.rejects(requestAuthorizedMeetupDeltas(["own-1","own-2"],async id=>({
 data:{ok:true,communityId:id,added:id==="own-1"?Number.MAX_SAFE_INTEGER:1,updated:0,unchanged:0}
})),/INVALID_RESPONSE/);
console.log("authorized multi-community delta client contract: PASS");
