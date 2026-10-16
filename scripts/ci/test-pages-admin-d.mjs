import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html=readFileSync(new URL("../../docs/admin.html",import.meta.url),"utf8");
const start=html.indexOf("async function accounts(){");
const end=html.indexOf("async function assignments(){",start);
assert.ok(start>0&&end>start,"Production pages ADMIN accounts function must be present");
const source=html.slice(start,end);

function setup({ permissionError=false, operationError=false }={}){
  const profiles=[
    {id:"ca-01",role:"ca",email:"test-01@example.invalid",niantic_id:"sample",created_at:"2026-10-01"},
    {id:"ca-02",role:"ca",email:"test-02@example.invalid",niantic_id:"sample",created_at:"2026-10-01"},
    {id:"pending",role:"pending",email:"test-pending@example.invalid",created_at:"2026-10-01"},
    {id:"admin",role:"admin",email:"test-admin@example.invalid",created_at:"2026-10-01"},
  ];
  const grants=new Set(["ca-02"]), calls=[];
  const list={innerHTML:""};
  const status={textContent:"",style:{}};
  let lastMarkup=null, activeButtons=[];
  const app={
    innerHTML:"",
    querySelectorAll(){
      if(list.innerHTML===lastMarkup)return activeButtons;
      lastMarkup=list.innerHTML;
      activeButtons=[...list.innerHTML.matchAll(/<button\b([^>]+)>[^<]*<\/button>/g)]
        .filter(m=>/data-(?:role|d)=/.test(m[1]))
        .map(m=>{
          const attrs=m[1],attr=k=>attrs.match(new RegExp(k+'="([^"]*)"'))?.[1]??null;
          return {
            dataset: {role:attr("data-role"),id:attr("data-id"),d:attr("data-d")},
            disabled:false,
            getAttribute:attr,
            hasAttribute:k=>attr(k)!==null,
            onclick:null,
          };
        });
      return activeButtons;
    },
  };
  const client={
    from(name){
      return {
        select(){return this;},
        order:async()=>({data:profiles,error:null}),
        eq:async()=>({data:[...grants].map(user_id=>({user_id,permission_code:"D"})),
          error:permissionError?new Error("simulated permission read failure"):null}),
      };
    },
    functions:{
      async invoke(slug,{body}){
        assert.equal(slug,"admin-manage");
        calls.push(body);
        if(operationError)return {error:new Error("simulated request rejection"),data:null};
        if(body.action==="set_permission"){
          if(body.enabled)grants.add(body.userId);
          else grants.delete(body.userId);
        }else if(body.action==="set_role"){
          const p=profiles.find(x=>x.id===body.userId);
          if(p)p.role=body.role;
          if(p&&body.role!=="ca")grants.delete(body.userId);
        }
        return {error:null,data:{ok:true}};
      },
    },
  };
  const context={
    app,document:{getElementById:k=>k==="list"?list:k==="accountsStatus"?status:null},
    client,
    title:()=>"<section>accounts</section>",
    msg:s=>"<section>"+s+"</section>",
    e:s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
    fmt:s=>s,
    alert:()=>{throw new Error("Unexpected alert")},
    Error,
  };
  runInNewContext(source+";globalThis.testAccounts=accounts",context);
  const getButtons=selector=>app.querySelectorAll().filter(b=>
    selector==="d"?b.dataset.d!==null:b.dataset.role!==null);
  return {accounts:context.testAccounts,list,status,calls,getButtons,grants,profiles};
}

test("Only CA accounts have a D toggle, not pending or ADMIN",async()=>{
 const f=setup();
 await f.accounts();
 assert.equal(f.getButtons("d").length,2);
 assert.ok(f.list.innerHTML.includes("D ✓"));
 assert.ok(!f.list.innerHTML.includes("S権限"));
 assert.equal(f.getButtons("d")[0].getAttribute("aria-pressed"),"false");
 assert.equal(f.getButtons("d")[1].getAttribute("aria-pressed"),"true");
});
test("S is retired in UI; no S request or S toggle",async()=>{
 assert.ok(!source.includes('permissionCode:"S"'));
 assert.ok(!source.includes("S ✓"));
 const f=setup();await f.accounts();
 assert.equal(f.getButtons("d").length,2);
});
test("D grant uses only D permission via admin-manage",async()=>{
 const f=setup();await f.accounts();
 await f.getButtons("d")[0].onclick();
 assert.equal(f.calls.length,1);
 assert.equal(JSON.stringify(f.calls[0]),JSON.stringify({action:"set_permission",permissionCode:"D",userId:"ca-01",enabled:true}));
 assert.ok(f.grants.has("ca-01"));
});
test("D revoke uses only D permission",async()=>{
 const f=setup();await f.accounts();
 await f.getButtons("d")[1].onclick();
 assert.equal(f.calls[0].enabled,false);
 assert.equal(f.grants.has("ca-02"),false);
});
test("Permission read failure prevents every mutation",async()=>{
 const f=setup({permissionError:true});await f.accounts();
 assert.equal(f.getButtons("d").length,0);
 assert.equal(f.getButtons("role").length,0);
 assert.ok(f.list.innerHTML.includes("変更操作は停止"));
 assert.equal(f.calls.length,0);
});
test("API mutation failure surfaces an error, never claims success",async()=>{
 const f=setup({operationError:true});await f.accounts();
 await f.getButtons("d")[0].onclick();
 assert.equal(f.status.textContent,"変更を確認できませんでした。最新の状態を再取得してください。");
 assert.equal(f.grants.has("ca-01"),false);
});
test("Existing role button continues using set_role",async()=>{
 const f=setup();await f.accounts();
 const pendingButton=f.getButtons("role").find(x=>x.dataset.id==="ca-01"&&x.dataset.role==="pending");
 assert.ok(pendingButton);
 await pendingButton.onclick();
 assert.equal(f.calls[0].action,"set_role");
 assert.equal(f.calls[0].userId,"ca-01");
});
test("No live credentials or participant data are needed by tests",()=>{
 assert.ok(!source.includes("service_role"));
 assert.ok(!source.includes("Campfire"));
 assert.ok(!source.includes("CSV_EXPORT"));
});
