// Fast synthetic layout-policy tests. Browser-based iPhone confirmation follows.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const code=readFileSync(new URL("../docs/community-title-fit.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../docs/index.html",import.meta.url),"utf8");
assert.ok(html.includes("community-title-fit.js?v=20261010-bracket2"),"Page must load the fitting code");
assert.ok(code.includes(".community-hub-layout .community-hero-row h1"),"Must target only Community heading");
assert.ok(!code.includes(".feature-app") && !code.includes("stamp_collections"),
  "Must not manipulate the four feature buttons or medals");

function simulate({name,weight,width=200,viewport=390,expectedSize,expectedLines}){
  const attributes=new Map();
  const style={
    removeProperty(key){
      const camel=key.replace(/^-webkit-/, "webkit-").replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
      delete this[camel];
    },
  };
  let text=name;
  let bracketParts=null;
  const heading={
    get textContent(){return text;},
    set textContent(next){text=next;bracketParts=null;},
    title:"",
    style,
    parentElement:{clientWidth:width},
    setAttribute(key,value){attributes.set(key,String(value));},
    getAttribute(key){return attributes.get(key)||null;},
    removeAttribute(key){attributes.delete(key);},
    matches(selector){return selector.includes(".community-hero-row");},
    replaceChildren(...nodes){
      text=nodes.filter(n=>n.kind==="text").map(n=>n.value).join("");
      bracketParts=nodes.some(n=>n.kind==="br")
        ?nodes.filter(n=>n.kind==="text").map(n=>n.value):null;
    },
    get clientWidth(){return width;},
    get scrollWidth(){
      const size=parseFloat(this.style.fontSize)||22;
      if(bracketParts){
        return Math.max(...bracketParts.map(part=>
          Math.ceil(size*weight*part.length/name.length)));
      }
      return this.style.whiteSpace==="nowrap"?Math.ceil(size*weight):width;
    },
    get scrollHeight(){
      const size=parseFloat(this.style.fontSize)||22;
      if(bracketParts){
        return bracketParts.reduce((n,part)=>n+Math.ceil(size*weight*part.length/name.length/width),0)*size*1.2;
      }
      return Math.ceil(size*weight/width)*size*1.2;
    },
  };
  const listeners=new Map();
  const context={
    window:{
      innerWidth:viewport,
      addEventListener(type,handler){listeners.set(type,handler);},
    },
    document:{
      querySelector(selector){return selector.includes(".community-hero-row")?heading:null;},
      getElementById(id){return id==="app"?{}:null;},
      createTextNode(value){return {kind:"text",value};},
      createElement(tag){return {kind:tag.toLowerCase()};},
    },
    MutationObserver:class{observe(){}},
    requestAnimationFrame(handler){handler();},
    getComputedStyle(node){
      return {lineHeight:((parseFloat(node.style.fontSize)||22)*1.2)+"px"};
    },
  };
  runInNewContext(code,context);
  assert.equal(heading.title,name,"Full Community name must remain accessible");
  assert.equal(attributes.get("aria-label"),name);
  if(viewport<=480){
    assert.equal(heading.style.fontSize,expectedSize+"px",name+" font size");
    assert.equal(attributes.get("data-ca-title-lines"),expectedLines,name+" layout");
    assert.equal(heading.textContent,name,"Visible text must never change");
  } else {
    assert.equal(heading.style.fontSize,undefined,"Do not alter desktop typography");
  }
  return {heading,attributes,context,listeners};
}

simulate({name:"高松 CITY",weight:8,width:200,expectedSize:22,expectedLines:"1"});
simulate({name:"Medium Community",weight:10,width:200,expectedSize:20,expectedLines:"1"});
simulate({name:"Longest one-line title",weight:11,width:200,expectedSize:18,expectedLines:"1"});
simulate({name:"Long Community / mixed 日本語",weight:16,width:200,expectedSize:20,expectedLines:"2"});
simulate({name:"Extra Long Community / mixed 日本語",weight:21,width:200,expectedSize:19,expectedLines:"2"});
simulate({name:"Very Long English Community Title With Many Words",weight:60,width:200,expectedSize:18,expectedLines:"2-ellipsis"});
simulate({name:"Desktop Community Name",weight:60,width:500,viewport:900});
// A short parenthesized name stays on one line, with no forced break.
const short=simulate({name:"横手（交流会）",weight:7,width:200,expectedSize:22,expectedLines:"1"});
assert.equal(short.attributes.get("data-ca-title-break"),undefined);
// Long labels break before the opening parenthesis, not halfway through it.
for(const label of ["ポケモン GO 横手(ミートアップ作成用)","ポケモン GO 横手（ミートアップ作成用）"]){
  const result=simulate({name:label,weight:18,width:210,expectedSize:20,expectedLines:"2-parenthesis"});
  assert.equal(result.attributes.get("data-ca-title-break"),"parenthesis",label+" bracket rule");
  assert.equal(result.heading.textContent,label,"Keep original Community name intact");
}
// If the parenthesized explanation itself exceeds a full line, fall back to
// the existing general two-line ellipsis instead of forcing three lines.
const huge=simulate({name:"横手（とても長いミートアップ開催予定のお知らせと説明文）",weight:60,width:200,expectedSize:18,expectedLines:"2-ellipsis"});
assert.equal(huge.attributes.get("data-ca-title-break"),undefined);


const dynamic=simulate({name:"Responsive Community",weight:10,width:200,expectedSize:20,expectedLines:"1"});
dynamic.context.window.innerWidth=900;
dynamic.listeners.get("resize")();
assert.equal(dynamic.heading.style.fontSize,undefined,"Desktop resize clears mobile font size");
assert.equal(dynamic.attributes.get("data-ca-title-lines"),undefined,"Desktop resize clears mobile layout");

console.log("Community name auto-fit: 12 viewport/length/bracket checks PASS (synthetic)");
