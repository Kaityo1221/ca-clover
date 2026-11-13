// Static regression only: protects the CA photo UI contract without live services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const docs=new URL('../docs/',import.meta.url);
const get=(p)=>readFileSync(new URL(p,docs),'utf8');
const home=get('index.html');
const photo=get('profile-photo.mjs');
const settings=get('settings-accordion.mjs');
const greeting=get('exchange-message.mjs');
const medal=get('stamp-rally.html');
const checks=[
 ['account button omitted from top nav',home.includes('const items=[]; // The top-left Clover is the My Community home action.')&&!home.includes('const items=[["my","My Community"]]')&&!home.includes('const items=[["my","My Community"],["account","アカウント"]]')],
 ['account still reachable from settings',settings.includes('settingsAccountLink')&&home.includes("onAccount:function(){go('account')}")&&home.includes('if(v==="account"){renderAccount();return}')],
 ['first-time CA can still register trainer name',home.includes('id="toAccount"')&&home.includes('go("account")')],
 ['admin navigation preserved',home.includes('items.push(["zoroark-ideas","🦊 お題メモ"])')&&home.includes('admin.html?v=20260921-1815')],
 ['settings entry',home.includes('id="mySettingsButton"')&&home.includes('go("settings")')],
 ['photo upload and delete controls',settings.includes('profilePhotoSave')&&settings.includes('profilePhotoDelete')],
 ['five-card settings menu',settings.includes('settingsProfileLink')&&settings.includes('settingsAccountLink')&&settings.includes('settingsMenuScreen')&&settings.includes('settingsProfileScreen')],
 ['photo and greeting combined',settings.includes('プロフィール写真・一言')&&settings.includes('登録・変更・削除')&&settings.includes('settingsPhotoPanel')&&settings.includes('settingsMessagePanel')&&!settings.includes('settingsMessageToggle')],
 ['settings module route',home.includes('settings-accordion.mjs')&&settings.includes('settingsProfileLink')],
 ['exchange greeting name',settings.includes('一言メッセージ')&&!settings.includes('交換時の一言')&&!settings.includes('メダル表示プレビュー')],
 ['greeting owner-only UI',greeting.includes('client.auth.getUser()')&&greeting.includes("'ca_exchange_messages'")&&greeting.includes('MAX_LENGTH=60')],
 ['greeting medal and fallbacks',medal.includes('ca_medal_exchange_message')&&medal.includes('clearMedalExchangeMessage()')&&medal.includes('caMedalExchangeText.textContent=value')],
 ['compression bounds',photo.includes('let side = 256')&&photo.includes('50 * 1024')&&photo.includes("'image/webp'")],
 ['Safari JPEG encoder fallback',photo.includes("['image/webp', 'image/jpeg']")&&photo.includes("out.type !== format")],
 ['JPEG contentType and extension consistency',photo.includes("'image/webp' ? 'webp' : 'jpg'")&&photo.includes("cacheControl: '3600', contentType, upsert: false")],
 ['no public upload without gate',photo.includes('window.CA_PROFILE_PHOTO_UPLOAD_ENABLED === true')],
 ['conditional replace',photo.includes(".eq('storage_path', oldPath)")],
 ['conditional delete',photo.includes(".delete().eq('user_id', uid).eq('storage_path', path)")],
 ['separate medal corner row',medal.includes('id="caMedalPhotoRow"')&&medal.indexOf('id="caMedalPhotoRow"')<medal.indexOf('id="stamp3d"')],
 ['no medal overlay positioning',medal.includes('.ca-medal-photo-row{display:flex;align-items:flex-start')&&!/\.ca-medal-photo-row\{[^}]*position:absolute/.test(medal)],
 ['portrait and bubble connection',medal.includes('flex:0 0 76px')&&medal.includes('.ca-medal-exchange-message::before')&&medal.indexOf('id="caMedalExchangeMessage"')<medal.indexOf('id="stamp3d"')],
 ['authoritative CA identity RPC',medal.includes('ca_medal_profile_photo_path')],
 ['no stale photo cache',!medal.includes('caPhotoPathCache')],
 ['private signed photo URL',medal.includes('createSignedUrl(path,600)')],
 ['fallback and cancellation',medal.includes('clearMedalProfilePhoto()')&&medal.includes('caMedalPhoto.onerror')],
 ['existing medal listing',medal.includes('全国メダル一覧')&&medal.includes('id="regions"')],
 ['existing 3D medal',medal.includes('mountStampMedal3D')],
 ['existing exchange metadata',medal.includes('stamp_reunions')]
];
new Function(photo.replace('export function mountProfilePhoto','function mountProfilePhoto'));
new Function(settings.replace('export function mountSettings','function mountSettings'));
new Function(greeting.replace('export function mountExchangeMessage','function mountExchangeMessage'));
for(const m of medal.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 if(/importmap|type="application\/json"/.test(m[1]) || !m[2].trim())continue;
 new Function(m[2]);
}
for(const [name,ok] of checks){console.log((ok?'PASS ':'FAIL ')+name);assert.ok(ok,name)}
console.log('PHOTO UI STATIC PASS '+checks.length+'/'+checks.length);
