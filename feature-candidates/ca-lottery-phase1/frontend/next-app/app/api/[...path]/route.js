export const dynamic='force-dynamic';
export const runtime='nodejs';

const QA_NEXT_HOST='127.0.0.1:41739';
const QA_LOCAL_ORIGIN='http://'+QA_NEXT_HOST;
const QA_API_ORIGIN='http://127.0.0.1:41738';

function permittedOrigin(){
 const value=process.env.LOTTERY_QA_HTTPS_ORIGIN;
 if(!value)return QA_LOCAL_ORIGIN;
 try{
  const url=new URL(value);
  if(url.protocol==='https:'&&url.origin===value&&/(?:\.test|\.local)$/.test(url.hostname)
    &&!url.username&&!url.password&&!url.search&&!url.hash)return value;
 }catch{}
 return null;
}

export async function POST(request,{params}){
 const permitted=permittedOrigin();
 // Next.js may construct request.url using the internal reverse-proxy origin;
 // that value is not the browser-facing origin and is not a reliable CSRF guard.
 // Instead, require the exact browser Origin and a strictly allowlisted Host.
 const host=request.headers.get('host');
 const allowedHosts=permitted?[QA_NEXT_HOST,new URL(permitted).host]:[];
 if(process.env.VERCEL||process.env.NODE_ENV==='production'||!permitted
   ||request.headers.get('origin')!==permitted||!allowedHosts.includes(host))
  return Response.json({error:'隔離環境で開いてください'},{status:403});
 const path=(await params).path.join('/');
 if(!/^(?:room\/[0-9a-f-]{36}\/)?[a-z]+$/.test(path))return Response.json({error:'不正なURL'},{status:404});
 const headers={'content-type':request.headers.get('content-type')||'',origin:permitted,cookie:request.headers.get('cookie')||''};
 try{
  const response=await fetch(QA_API_ORIGIN+'/api/'+path,{method:'POST',headers,body:request.body,duplex:'half',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  const output=new Headers({'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'});
  for(const cookie of response.headers.getSetCookie())output.append('set-cookie',cookie);
  return new Response(response.body,{status:response.status,headers:output});
 }catch{return Response.json({error:'隔離APIに接続できません'},{status:503});}
}
