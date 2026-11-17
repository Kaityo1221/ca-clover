// V8 isolated shared picker. No JWT, localStorage writes or catalog writes.
const ROOT="https://raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=x=>String(x??"").normalize("NFKC").toLocaleLowerCase("ja-JP").trim();
const generations=new Map();
async function gen(n){
 if(!Number.isInteger(n)||n<1||n>9)throw Error("Invalid generation");
 if(!generations.has(n))generations.set(n,fetch(ROOT+"gen"+n+".json",{cache:"no-store"})
  .then(r=>{if(!r.ok)throw Error("Pokédex HTTP error");return r.json()})
  .then(rows=>{if(!Array.isArray(rows))throw Error("Invalid Pokédex JSON");
   return rows.filter(x=>x&&typeof x.jp==="string"&&typeof x.no==="string")
    .map(x=>({...x,en:typeof x.en==="string"?x.en:"",gen:x.gen||n}))})
  .catch(e=>{generations.delete(n);throw e}));
 return generations.get(n);
}
export async function searchPokemonV8(query){
 const q=norm(query);
 if(!q)return {hits:[],partial:false};
 const results=await Promise.allSettled(Array.from({length:9},(_,i)=>gen(i+1)));
 const found=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
 if(!found.length)throw Error("図鑑データを取得できません");
 return {hits:found.filter(x=>[x.jp,x.en,x.no].some(v=>norm(v).includes(q))).slice(0,40),
   partial:results.some(x=>x.status==="rejected")};
}
export function makePokemonPickerV8(){
 let dialog=null,handler=null,requestId=0,destroyed=false;
 const style=document.createElement("style");
 style.textContent=".zpk{border:0;border-radius:16px;width:min(94vw,640px);max-height:92dvh;box-sizing:border-box;padding:16px}.zpk::backdrop{background:#0f172a99}.zpk input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;min-height:44px}.zpk button{min-height:44px;padding:10px 12px;margin:3px 0;border-radius:9px;border:1px solid #84cc16;background:#ecfccb;color:#365314;font:inherit}.zpk .hits{max-height:53dvh;overflow:auto}.zpk .hits button{display:block;width:100%;text-align:left}.zpk small{display:block;color:#64748b;font-size:12px}";
 document.head.append(style);
 function close(){
  ++requestId;
  if(dialog){dialog.removeEventListener("click",click);dialog.removeEventListener("input",input);
   dialog.removeEventListener("compositionend",input);dialog.removeEventListener("cancel",cancel);
   if(dialog.open)dialog.close();dialog.remove();dialog=null}
  handler=null;
 }
 const cancel=()=>close();
 function click(e){
  const b=e.target.closest("button");if(!b)return;
  if(b.hasAttribute("data-close")){close();return}
  if(b.hasAttribute("data-index")){
   const i=Number(b.dataset.index),p=Number.isSafeInteger(i)?dialog?._hits?.[i]:null;
   const fn=handler;if(!p||!fn)return;
   close();fn({jp:p.jp,en:p.en,no:p.no,gen:p.gen});
  }
 }
 async function input(e){
  if(!dialog||e.isComposing||!e.target.matches("[data-query]"))return;
  const query=e.target.value,request=++requestId,box=dialog.querySelector(".hits");
  box.textContent=query.trim()?"検索中…":"日本語・英語・図鑑番号で検索できます";
  if(!query.trim())return;
  try{
   const data=await searchPokemonV8(query);
   if(!dialog||request!==requestId)return;
   dialog._hits=data.hits;
   box.innerHTML=data.hits.map((p,i)=>'<button type="button" data-index="'+i+'">'+esc(p.jp)+
    '<small>No.'+esc(p.no)+' / '+esc(p.en)+' / Gen '+esc(p.gen)+'</small></button>').join("")||
    "<p>一致する候補がありません。</p>";
   if(data.partial)box.insertAdjacentHTML("beforeend","<p>一部世代を取得できませんでした。</p>");
  }catch(e){if(dialog&&request===requestId)box.textContent="検索失敗："+(e.message||"通信エラー")}
 }
 function open(side,fn){
  if(destroyed)throw Error("Picker already destroyed");
  close();handler=fn;
  dialog=document.createElement("dialog");dialog.className="zpk";
  dialog.innerHTML='<button type="button" data-close>閉じる</button><h2>ポケモン'+esc(side.toUpperCase())+
   'を選択</h2><label for="zpk-query">日本語・英語・図鑑番号</label>'+
   '<input id="zpk-query" data-query autocomplete="off" placeholder="検索する">'+
   '<div class="hits" role="status">日本語・英語・図鑑番号で検索できます</div>';
  dialog._hits=[];document.body.append(dialog);
  dialog.addEventListener("click",click);dialog.addEventListener("input",input);
  dialog.addEventListener("compositionend",input);dialog.addEventListener("cancel",cancel);
  dialog.showModal();dialog.querySelector("input")?.focus();
 }
 function destroy(){destroyed=true;close();style.remove()}
 return {open,destroy};
}