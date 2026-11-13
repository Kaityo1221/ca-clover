import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureSetup,community} from './meetup-mobile-fixture.mjs';
export async function startPreview({port=0}={}){
  const docs=fileURLToPath(new URL('../../docs/',import.meta.url));
  const server=createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://127.0.0.1');
      if(u.pathname==='/'&&!u.hash){res.writeHead(302,{location:'/docs/index.html#community:'+community});res.end();return;}
      const rel=u.pathname.replace(/^\/docs\//,'');const file=resolve(docs,decodeURIComponent(rel));
      if(!u.pathname.startsWith('/docs/')||!file.startsWith(resolve(docs)+sep))throw Error();
      let content=await readFile(file);
      if(rel==='index.html'){
        const opts={role:u.searchParams.get('role')==='admin'?'admin':u.searchParams.get('role')==='pending'?'pending':'ca',d:u.searchParams.get('d')!=='0',own:u.searchParams.get('own')!=='0'};
        content=content.toString().replace(/<script\b[^>]*src="https:[^"]*"[^>]*><\/script>/g,'').replace('<head>','<head><script>'+fixtureSetup(opts)+'</script>');
        // Visible fixture label; preserve the product palette and real markup.
        content=content.replace('<main id="app"','<div style="background:#fffbeb;text-align:center;padding:6px;font-size:11px">隔離プレビュー · すべて合成データ · 本番通信なし</div><main id="app"');
      }
      if(rel==='meetup-batch-config.mjs')content="export const MEETUP_BATCH_ENDPOINT='https://fixture.invalid/batch';";
      res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[extname(file)]||'application/octet-stream'),'cache-control':'no-store'});res.end(content);
    }catch{res.writeHead(404);res.end('not found');}
  });
  await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,url:'http://127.0.0.1:'+server.address().port+'/docs/index.html#community:'+community};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const preview=await startPreview({port:Number(process.env.PORT)||4173});console.log(preview.url);}
