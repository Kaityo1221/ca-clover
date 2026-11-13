// Production boundary smoke only: no user tokens and no participant data.
import assert from 'node:assert/strict';
const endpoint='https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/meetup-roster-batch';
const body=JSON.stringify({meetupIds:['00000000-0000-0000-0000-000000000001'],offset:0,remainingBytes:8000000});
for(const [label,headers] of [
  ['no bearer',{'origin':'https://kaityo1221.github.io','content-type':'application/json'}],
  ['invalid bearer',{'origin':'https://kaityo1221.github.io','authorization':'Bearer invalid-no-real-user','content-type':'application/json'}]
]){
 const response=await fetch(endpoint,{method:'POST',headers,body,signal:AbortSignal.timeout(15000),redirect:'error'});
 assert.ok([401,403].includes(response.status),label+': unexpected HTTP '+response.status);
 const text=await response.text();
 assert.ok(text.length<5000,'response unexpectedly large');
 assert.ok(!text.includes('username')&&!text.includes('display_name'),'unexpected roster fields');
 console.log('PASS '+label+' rejected HTTP='+response.status);
}
