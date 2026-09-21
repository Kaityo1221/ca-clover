import assert from "node:assert/strict";
import {
  parseCampfireShareUrl,
  resolveCampfireShareUrl,
} from "../supabase/functions/_shared/campfire-share-url.js";

const meetupId="cd424265-2138-4555-aa48-632dd83fd5e3";
const clubId="d9a57a2a-98e7-4c97-8458-21a8954e4812";

const publicCommunityInvite="https://campfire.onelink.me/eBr8?deep_link_sub1=cj1jbHVicyZjPWU5ZjUxZTY3LTlmMTUtNDU4Yi1iYjU5LTRlMjExYjdmZTAxZSZpPXRydWU=";
const parsedCommunity=parseCampfireShareUrl(publicCommunityInvite);
assert.equal(parsedCommunity.kind,"community");
assert.equal(parsedCommunity.id,"e9f51e67-9f15-458b-bb59-4e211b7fe01e");

const communityWithChannel="https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPTgxNjZiMzViLTBmNTItNDgwZS04YTBiLTg1YzY4ZjMzY2VjMCZjaD1mMTZkOWE1MS03OTUxLTQ2ZDMtOWYzNi0zZDJkZDYyYWM1YjE=";
const parsedChannel=parseCampfireShareUrl(communityWithChannel);
assert.equal(parsedChannel.kind,"community");
assert.equal(parsedChannel.id,"8166b35b-0f52-480e-8a0b-85c68f33cec0");

const meetupDeepLink=Buffer.from(
  "r=events&e="+meetupId+"&c="+clubId,
  "utf8",
).toString("base64");
const meetupOneLink="https://campfire.onelink.me/eBr8?af_dp=campfire://&deep_link_sub1="+encodeURIComponent(meetupDeepLink);
const parsedMeetup=parseCampfireShareUrl(meetupOneLink);
assert.equal(parsedMeetup.kind,"meetup");
assert.equal(parsedMeetup.id,meetupId);

const directMeetup="https://campfire.scopely.com/discover/meetup/"+meetupId;
const parsedDirect=parseCampfireShareUrl(directMeetup);
assert.equal(parsedDirect.kind,"meetup");
assert.equal(parsedDirect.id,meetupId);

const resolvedShort=await resolveCampfireShareUrl("https://cmpf.re/test",{
  fetchImpl:async()=>({url:directMeetup}),
});
assert.equal(resolvedShort.kind,"meetup");
assert.equal(resolvedShort.id,meetupId);

const bareId=parseCampfireShareUrl(meetupId);
assert.equal(bareId.kind,"invalid");

console.log("Campfire share URL resolver tests passed");
