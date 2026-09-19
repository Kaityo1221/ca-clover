const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  return new Response(JSON.stringify({
    ok:false,
    retired:true,
    error:"cmpf-tools sync is retired. CA Clover is switching to direct Campfire discovery."
  }),{
    status:410,
    headers:{...corsHeaders,"Content-Type":"application/json"}
  });
});
