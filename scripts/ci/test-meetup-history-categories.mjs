import test from "node:test";
import assert from "node:assert/strict";
import {classifyMeetup,filterMeetupsByCategory,MEETUP_CATEGORIES} from "../../docs/meetup-history-categories.mjs";
const cases=[
 ["Community Day Classic","community-day"],
 ["セビエコミュニティ・デイ","community-day"],
 ["Chandelure Super Mega Raid Day","raid-day"],
 ["Shadow Raid Day","raid-day"],
 ["Gigantamax Cinderace Max Battle Day","max-battle"],
 ["Rhyhorn Max Monday","max-battle"],
 ["シェルダースポットライトアワー","spotlight"],
 ["Road of Legends: Tuesday Raid Hour","raid-hour"],
 ["ネクロズマレイドアワー","raid-hour"],
 ["GO Wild Area 2026: Global Day 2","other"],
 ["Pokémon GO Fest 2025: Max Finale Day 2","other"],
 ["Mega Raid","other"]
];
test("6 categories plus all",()=>assert.equal(MEETUP_CATEGORIES.length,7));
for(const [event,expected] of cases)test(event,()=>assert.equal(classifyMeetup({campfire_live_event_name:event}),expected));
test("fallback title when event name is generic",()=>assert.equal(classifyMeetup({campfire_live_event_name:"Mega Raid",title:"メガタブンネメガレイドデイ"}),"raid-day"));
test("prefer official name over misleading meetup title",()=>assert.equal(classifyMeetup({campfire_live_event_name:"Community Day",title:"レイドアワーも行こう"}),"community-day"));
test("returns filtered records without changing original",()=>{
 const entries=[{title:"スポライ"},{title:"Community Day"},{title:"レイドアワー"}];
 assert.deepEqual(filterMeetupsByCategory(entries,"spotlight"),[entries[0]]);
 assert.equal(entries.length,3);
});
test("unrecognized filters rejected",()=>assert.throws(()=>filterMeetupsByCategory([],"banana")));
