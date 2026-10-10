import assert from "node:assert/strict";
import {partitionCaLinks} from "../supabase/functions/_shared/ca-link-diff.mjs";

const existing=[
  {id:"keep",community_id:"tokyo",ca_member_id:"syo"},
  {id:"protected",community_id:"saitama",ca_member_id:"jun"},
  {id:"remove",community_id:"other",ca_member_id:"retired"},
];
const desired=[
  {community_id:"tokyo",ca_member_id:"syo"},
  {community_id:"chiba",ca_member_id:"new"},
];
const verified=[
  {community_id:"tokyo",ca_member_id:"syo"},
  {community_id:"saitama",ca_member_id:"jun"},
];

const {protectedStaleLinks,removableIds}=partitionCaLinks(existing,desired,verified);
assert.deepEqual(protectedStaleLinks,[{community_id:"saitama",ca_member_id:"jun"}]);
assert.deepEqual(removableIds,["remove"],"only unreferenced, stale links can be deleted");

assert.deepEqual(
  partitionCaLinks(existing,existing,verified),
  {protectedStaleLinks:[],removableIds:[]},
  "unchanged master links must remain untouched"
);

assert.deepEqual(
  partitionCaLinks([],desired,[]),
  {protectedStaleLinks:[],removableIds:[]},
  "first sync deletes nothing"
);

assert.deepEqual(
  partitionCaLinks(
    [{id:"relocated",community_id:"old",ca_member_id:"syo"}],
    [{community_id:"new",ca_member_id:"syo"}],
    [{community_id:"old",ca_member_id:"syo"}]
  ),
  {
    protectedStaleLinks:[{community_id:"old",ca_member_id:"syo"}],
    removableIds:[]
  },
  "a CA changing home Community needs review, not identity deletion"
);

const many=Array.from({length:180},(_,i)=>({
  id:"row"+i,community_id:"c"+i,ca_member_id:"ca"+i
}));
const stress=partitionCaLinks(many,[],many.slice(0,35));
assert.equal(stress.protectedStaleLinks.length,35);
assert.equal(stress.removableIds.length,145);
console.log("CA master identity/link reconciliation: 5 scenarios PASS");
