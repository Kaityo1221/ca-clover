/* CA Clover | Validated, anonymized community medal exchange aggregates. No raw identities. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.StampExchangeCommunityCore=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const DAY=86400000, JST=9*3600000;
 function integer(v,label){
  if(!Number.isSafeInteger(v)||v<0)throw new Error("集計数値が不正です: "+label);
  return v;
 }
 function dayValue(day){
  if(typeof day!=="string"||!(/^\d{4}-\d{2}-\d{2}$/).test(day))throw new Error("日付が不正です");
  const millis=Date.parse(day+"T00:00:00Z");
  if(!Number.isFinite(millis)||new Date(millis).toISOString().slice(0,10)!==day)throw new Error("日付が不正です");
  return millis;
 }
 function nextDay(day){return new Date(dayValue(day)+DAY).toISOString().slice(0,10)}
 function asJstDay(iso){
  const n=Date.parse(iso);
  if(!Number.isFinite(n))throw new Error("集計時刻が不正です");
  return new Date(n+JST).toISOString().slice(0,10);
 }
 function normalize(payload){
  if(!payload||typeof payload!=="object"||payload.version!==1)throw new Error("集計APIの形式が正しくありません");
  const asOf=asJstDay(payload.asOf);
  const total=integer(payload.total,"全期間");
  const participants=integer(payload.participants,"参加者");
  const pairs=integer(payload.pairs,"交換ペア");
  if(pairs>total||participants>total*2)throw new Error("累計内訳が一致しません");
  if(!Array.isArray(payload.days)||payload.days.length>3650)throw new Error("日別件数が不正です");
  const source=new Map();
  let sum=0,firstPairsTotal=0,lastDay=null;
  for(const d of payload.days){
   if(!d||typeof d!=="object")throw new Error("日別データが不正です");
   dayValue(d.day);
   if(d.day>asOf||source.has(d.day)||(lastDay&&d.day<=lastDay))throw new Error("日付順序が不正です");
   lastDay=d.day;
   const count=integer(d.count,"交換回数"),unique=integer(d.participants,"参加者"),dpairs=integer(d.pairs,"ペア");
   const first=integer(d.firstPairs,"初記録ペア"),repeat=integer(d.repeatPairs,"再交換");
   if(first+repeat!==count||dpairs>count||unique>count*2)throw new Error("日別内訳が一致しません");
   if(!Array.isArray(d.hours)||d.hours.length!==24)throw new Error("時間帯内訳が不正です");
   const hours=d.hours.map((v,i)=>integer(v,"時間帯"+i));
   if(hours.reduce((a,b)=>a+b,0)!==count)throw new Error("時間帯の合計が一致しません");
   source.set(d.day,{day:d.day,count,participants:unique,pairs:dpairs,firstPairs:first,repeatPairs:repeat,hours});
   sum+=count;firstPairsTotal+=first;
  }
  if(sum!==total||firstPairsTotal!==pairs)throw new Error("全期間の集計数が一致しません");
  if(payload.firstDate!==null&&payload.firstDate!==undefined&&payload.firstDate!==(payload.days[0]?.day??null))throw new Error("開始日の整合性エラー");
  if(payload.lastDate!==null&&payload.lastDate!==undefined&&payload.lastDate!==lastDay)throw new Error("最終日の整合性エラー");
  if(total>0&&!lastDay)throw new Error("日別内訳がありません");
  const days=[];
  let cumulative=0;
  if(source.size){
   for(let day=payload.days[0].day;day<=asOf;day=nextDay(day)){
    if(days.length>=3650)throw new Error("集計期間が上限を超えました");
    const data=source.get(day)||{day,count:0,participants:0,pairs:0,firstPairs:0,repeatPairs:0,hours:Array(24).fill(0)};
    cumulative+=data.count;
    days.push({...data,cumulative});
   }
  }
  return {asOfDate:asOf,asOf:payload.asOf,total,participants,pairs,
    firstDate:payload.firstDate||null,lastDate:payload.lastDate||null,days};
 }
 return Object.freeze({normalize,asJstDay,nextDay});
});
