// Regression checks for high-resolution 3D medal image source selection.
// No network, Supabase, storage mutations or user data needed.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html=readFileSync(new URL("../docs/stamp-rally.html",import.meta.url),"utf8");
const begin=html.indexOf("function medalFaceTextureSources(");
const end=html.indexOf("\nasync function mountStampMedal3D(",begin);
assert.ok(begin>=0&&end>begin,"Source picker must exist in 3D medal page");
const pick=runInNewContext(html.slice(begin,end)+"\nmedalFaceTextureSources");
function names(...args){
 return Array.from(pick(...args),entry=>entry.kind==="storage"
  ?entry.bucket+":"+entry.path:"url:"+entry.url);
}
const design={
 archive_path:"full/a.png",
 thumbnail_path:"small/a.webp",
 source_avatar_url:"https://example.test/a-original.png"
};
assert.deepEqual(names(design,"https://example.test/a-thumb.webp","https://example.test/current.png"),[
 "community-icon-archive:full/a.png",
 "url:https://example.test/a-original.png",
 "url:https://example.test/current.png",
 "community-icon-thumbs:small/a.webp",
 "url:https://example.test/a-thumb.webp"
],"Original archived image must be first, thumbnails last");
assert.deepEqual(names(design,"https://example.test/a-thumb.webp","https://example.test/a-original.png"),[
 "community-icon-archive:full/a.png",
 "url:https://example.test/a-original.png",
 "community-icon-thumbs:small/a.webp",
 "url:https://example.test/a-thumb.webp"
],"Identical URLs must not be requested twice");
assert.deepEqual(names({thumbnail_path:"small/x.png"},"https://example.test/a-thumb.webp","https://example.test/current.png"),[
 "url:https://example.test/current.png",
 "community-icon-thumbs:small/x.png",
 "url:https://example.test/a-thumb.webp"
],"Missing archive must gracefully fall back to avatar then thumbnail");
assert.deepEqual(names(null,"https://example.test/thumb.png","https://example.test/current.png"),[
 "url:https://example.test/current.png",
 "url:https://example.test/thumb.png"
],"No saved design must still work");
assert.deepEqual(names(null,"",""),[],"Missing every source must not crash");
assert.match(html,/for\(const source of medalFaceTextureSources\(design,imageUrl,fallbackImageUrl\)\)/,
 "3D renderer must use the tested ordering");
assert.match(html,/client\.storage\.from\(source\.bucket\)\.download\(source\.path\)/,
 "Storage images must be downloaded with the existing authenticated client");
assert.match(html,/if\(objectUrl\)URL\.revokeObjectURL\(objectUrl\)/,
 "Failed blob URLs must be revoked");
assert.doesNotMatch(html,/if\(design\?\.thumbnail_path\)\s*\{/,
 "Old eager thumbnail-first path must not return");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(match=>match[1].trim()).filter(script=>script&&!script.startsWith('{"imports"'));
for(const script of scripts)new Function(script);
console.log("3D medal high-resolution source preference: 9 regression checks PASS");
