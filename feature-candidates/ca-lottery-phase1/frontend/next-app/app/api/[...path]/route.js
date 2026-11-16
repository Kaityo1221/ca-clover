export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request,{params}){
 const origin=new URL(request.url).origin;
 const permitted=process.env.LOTTERY_QA_HTTPS_ORIGIN||'http://127.0.0.1:41739';
 if(process.env.VERCEL||process.env.NODE_ENV==='production'||origin!==permitted||request.headers.get('origin')!==permitted)
  return Response.json({error:'隔離環境で開いてください'},{status:403});
 const path=(await params).path.join('/');
 if(!/^(?:room\/[0-9a-f-]{36}\/)?[a-z]+$/.test(path))return Response.json({error:'不正なURL'},{status:404});
 const headers={'content-type':request.headers.get('content-type')||'',origin:permitted,cookie:request.headers.get('cookie')||''};
 try{
  const response=await fetch('http://127.0.0.1:41738/api/'+path,{method:'POST',headers,body:request.body,duplex:'half',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  const output=new Headers({'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'});
  for(const cookie of response.headers.getSetCookie())output.append('set-cookie',cookie);
  return new Response(response.body,{status:response.status,headers:output});
 }catch{return Response.json({error:'隔離APIに接続できません'},{status:503});}
}

