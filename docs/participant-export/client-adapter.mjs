import {createCsvClickGuard} from './csv-click-guard.mjs';
import {ENGINE_POLICY} from './engine-policy.mjs';
// Public-safe adapter. No secret/source/store import, no automatic POST retries.
export function createCsvClient({fetcher,endpoint,origin,getBearer,download,onStatus=()=>{},clock,fullRoster=false}={}){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.origin!==origin||
    ![fetcher,getBearer,download,onStatus].every(f=>typeof f==='function'))throw new TypeError('fixed HTTPS endpoint required');
  const status=s=>{try{onStatus(s)}catch{/* UI errors never replay a POST */}};
  const guard=createCsvClickGuard({clock});
  let active;
  return Object.freeze({getState:guard.getState,cancel(){active?.abort()},exportCsv(body){return guard.run(async()=>{
    status('取得中');
    const controller=new AbortController();active=controller;let timer;
    const work=async()=>{
      const bearer=await getBearer();
      if(controller.signal.aborted||typeof bearer!=='string'||!bearer||/[\r\n]/.test(bearer))throw Error();
      const response=await fetcher(url.href,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
        signal:controller.signal,headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},body:JSON.stringify(body)});
      if(controller.signal.aborted)throw Error();
      if(response.status===200){
        const count=response.headers.get(fullRoster?'x-ca-clover-roster-count':'x-ca-clover-checkin-count');
        const time=response.headers.get('x-ca-clover-verified-at');
        const version=fullRoster?'full-roster-1':'2';
        if(response.headers.get('content-type')?.split(';')[0]!=='text/csv'||response.headers.get('x-ca-clover-csv-version')!==version||
          !/^(0|[1-9][0-9]{0,3})$/.test(count)||Number(count)>(fullRoster?5000:1000)||(fullRoster&&Number(count)===0)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time)||!Number.isFinite(Date.parse(time)))throw Error();
        await download(response,controller.signal,{expectedCount:Number(count),fullRoster});
        if(controller.signal.aborted)throw Error();
        status(`人数確認済み ${count}人 / ${time}`);
      }else{
        status(response.status===409?(fullRoster?'参加者情報が変わったか、名簿が空です。CSVは発行されません。':'新しい参加者が反映されるまで再取得'):
          response.status===502?'取得情報不一致、CSV未発行':'しばらくして再試行');
      }
      // Retain only rate-limit metadata, never Response / participant bytes.
      return {status:response.status,headers:new Headers({'retry-after':response.headers.get('retry-after')??''})};
    };
    const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error()),{once:true}));
    try{return await Promise.race([work(),cancelled,new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(Error());},ENGINE_POLICY.browserTimeoutMs);
    })]);}
    catch{status('しばらくして再試行');return {status:503};}
    finally{clearTimeout(timer);controller.abort();if(active===controller)active=undefined;}
  });}});
}
