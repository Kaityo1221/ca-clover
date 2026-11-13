// Static regression only: protects the CA photo UI contract without live services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const docs=new URL('../docs/',import.meta.url);
const get=(p)=>readFileSync(new URL(p,docs),'utf8');
const home=get('index.html');
const photo=get('profile-photo.mjs');
const medal=get('stamp-rally.html');
const checks=[
 ['settings entry',home.includes('id="mySettingsButton"')&&home.includes('go("settings")')],
 ['photo upload and delete controls',home.includes('id="profilePhotoSave"')&&home.includes('id="profilePhotoDelete"')],
 ['compression bounds',photo.includes('let side = 256')&&photo.includes('50 * 1024')&&photo.includes("'image/webp'")],
 ['Safari JPEG encoder fallback',photo.includes("['image/webp', 'image/jpeg']")&&photo.includes("out.type !== format")],
 ['JPEG contentType and extension consistency',photo.includes("'image/webp' ? 'webp' : 'jpg'")&&photo.includes("cacheControl: '3600', contentType, upsert: false")],
 ['no public upload without gate',photo.includes('window.CA_PROFILE_PHOTO_UPLOAD_ENABLED === true')],
 ['conditional replace',photo.includes(".eq('storage_path', oldPath)")],
 ['conditional delete',photo.includes(".delete().eq('user_id', uid).eq('storage_path', path)")],
 ['separate medal corner row',medal.includes('id="caMedalPhotoRow"')&&medal.indexOf('id="caMedalPhotoRow"')<medal.indexOf('id="stamp3d"')],
 ['no medal overlay positioning',medal.includes('.ca-medal-photo-row{min-height:62px;display:flex')&&!/\.ca-medal-photo-row\{[^}]*position:absolute/.test(medal)],
 ['authoritative CA identity RPC',medal.includes('ca_medal_profile_photo_path')],
 ['no stale photo cache',!medal.includes('caPhotoPathCache')],
 ['private signed photo URL',medal.includes('createSignedUrl(path,600)')],
 ['fallback and cancellation',medal.includes('clearMedalProfilePhoto()')&&medal.includes('caMedalPhoto.onerror')],
 ['existing medal listing',medal.includes('全国メダル一覧')&&medal.includes('id="regions"')],
 ['existing 3D medal',medal.includes('mountStampMedal3D')],
 ['existing exchange metadata',medal.includes('stamp_reunions')]
];
new Function(photo.replace('export function mountProfilePhoto','function mountProfilePhoto'));
for(const m of medal.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 if(/importmap|type="application\/json"/.test(m[1]) || !m[2].trim())continue;
 new Function(m[2]);
}
for(const [name,ok] of checks){console.log((ok?'PASS ':'FAIL ')+name);assert.ok(ok,name)}
console.log('PHOTO UI STATIC PASS '+checks.length+'/'+checks.length);
