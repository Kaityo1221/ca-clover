import assert from "node:assert/strict";
import {parseAuthorizedMeetupDelta} from "../src/lib/meetup-delta-api-contract.ts";
const expected={communityId:"own",added:2,updated:1,unchanged:3};
assert.deepEqual(parseAuthorizedMeetupDelta({...expected,ok:true},"own"),expected);
for(const payload of [
  {...expected,ok:false},
  {...expected,ok:true,communityId:"foreign"},
  {...expected,ok:true,added:-1},
  {...expected,ok:true,updated:1.5},
  {...expected,ok:true,unchanged:"3"},
  {ok:true,communityId:"own",added:0,updated:0},
  null,
]){
  assert.throws(()=>parseAuthorizedMeetupDelta(payload,"own"));
}
console.log("authorized Meetup delta response contract: PASS");
