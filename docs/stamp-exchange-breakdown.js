/* CA Clover exchange breakdown / administrator UI utility. No data writes. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.StampExchangeBreakdown=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const JST_MS=9*60*60*1000;
 function safeDate(value){
  const time=Date.parse(value);
  if(!Number.isFinite(time))throw new Error("交換完了日時が不正です。");
  const d=new Date(time+JST_MS);
  return {time,day:d.toISOString().slice(0,10),hour:d.getUTCHours()};
 }
 function tally(map,user,partner){
  if(!map.has(user))map.set(user,{userId:user,count:0,partners:new Set()});
  const x=map.get(user);x.count+=1;x.partners.add(partner);
 }
 function ranking(map){
  return [...map.values()].map(x=>({userId:x.userId,count:x.count,partners:x.partners.size}))
   .sort((a,b)=>b.count-a.count||b.partners-a.partners||a.userId.localeCompare(b.userId));
 }
 function summarize(records,asOf){
  if(!Array.isArray(records))throw new TypeError("取引履歴は配列で指定してください。");
  const now=safeDate(asOf||new Date().toISOString()).time;
  const usedKeys=new Set(),usedPairs=new Set(),allUsers=new Map(),allPeople=new Set(),allPairs=new Set(),days=new Map();
  const sorted=records.slice().sort((a,b)=>Date.parse(a?.completed_at)-Date.parse(b?.completed_at)||String(a?.exchange_key).localeCompare(String(b?.exchange_key)));
  for(const r of sorted){
   if(!r||!r.exchange_key)throw new Error("交換取引IDを確認できません。");
   if(usedKeys.has(r.exchange_key))continue;
   usedKeys.add(r.exchange_key);
   if(!r.completed_at||!r.user_a_id||!r.user_b_id||r.user_a_id===r.user_b_id)throw new Error("交換記録に不整合があります。");
   const {time,day,hour}=safeDate(r.completed_at);
   if(time>now)throw new Error("未来日時の交換記録があります。");
   const a=String(r.user_a_id),b=String(r.user_b_id);
   const pair=a<b?a+":"+b:b+":"+a;
   if(!days.has(day))days.set(day,{date:day,exchangeCount:0,firstPairs:0,repeatPairs:0,people:new Set(),pairs:new Set(),hours:Array(24).fill(0),users:new Map()});
   const d=days.get(day);
   d.exchangeCount++;d.people.add(a);d.people.add(b);d.pairs.add(pair);d.hours[hour]++;
   const first=!usedPairs.has(pair);
   if(first){d.firstPairs++;usedPairs.add(pair)}else d.repeatPairs++;
   allPeople.add(a);allPeople.add(b);allPairs.add(pair);
   tally(allUsers,a,b);tally(allUsers,b,a);tally(d.users,a,b);tally(d.users,b,a);
  }
  const byDay={};
  for(const [day,d] of days){
   byDay[day]={date:day,exchangeCount:d.exchangeCount,participantCount:d.people.size,uniquePairs:d.pairs.size,
    firstPairs:d.firstPairs,repeatPairs:d.repeatPairs,hours:d.hours.slice(),ranking:ranking(d.users)};
  }
  return {
   total:usedKeys.size,
   byDay,
   overall:{exchangeCount:usedKeys.size,participantCount:allPeople.size,uniquePairs:allPairs.size,ranking:ranking(allUsers)}
  };
 }
 return Object.freeze({summarize});
});
