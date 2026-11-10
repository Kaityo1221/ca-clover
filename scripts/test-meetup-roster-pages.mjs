import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('docs/meetup-roster-ui.mjs','utf8');
const page=readFileSync('docs/index.html','utf8');
test('roster UI lives separately from existing raffle/checkin export',()=>{
 assert.match(page,/rosterReady=import\('\.\/meetup-roster-ui\.mjs/);
 assert.match(page,/mountRosterButton\(\{root:back,meetup:m/);
 assert.doesNotMatch(page,/import\('\.\/participant-export-ui\.mjs/);
 assert.match(ui,/\/functions\/v1\/meetup-roster/);
 assert.doesNotMatch(ui,/抽選番号|participant-export\/client-adapter/);
});
test('no data without active user and D, existing session and status checks',()=>{
 assert.match(ui,/\.eq\('permission_code','D'\)/);
 assert.match(ui,/client\.auth\.getSession\(\)/);
 assert.match(ui,/session\?\.user\?\.id!==userId/);
 assert.match(ui,/response\.status!==200/);
 assert.match(ui,/response\.headers\.get\('x-ca-clover-roster-count'\)/);
 assert.match(ui,/URL\.revokeObjectURL/);
 assert.doesNotMatch(ui,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('admins see roster without D, CA still requires D and no hint visible',()=>{
 assert.match(ui,/if\(initial\.role==='admin'\)return initial/);
 assert.match(ui,/if\(permission\.error\|\|permission\.data\?\.permission_code!=='D'\)return null/);
 assert.doesNotMatch(ui,/D権限が必要|D権限を確認できません|管理者も対象/);
 assert.match(page,/meetup-roster-ui\.mjs\?v=20261110-petals-always1/);
});

test('Meetup card CSV invokes the same full-roster action as overview, not raffle CSV',()=>{
 assert.match(page,/mountRosterCards\(\{root:app,meetups:cardMeetups/);
 assert.match(ui,/export async function mountRosterCards/);
 assert.match(ui,/attachAction\(\{root:wrap,container:wrap,meetup/);
 assert.match(ui,/compact\?'CSV ↓':'名簿CSVを取得'/);
 assert.match(ui,/\/functions\/v1\/meetup-roster/);
 assert.doesNotMatch(page,/csvPanel\.mount|participantPanel\.leave|participantReady/);
 assert.doesNotMatch(ui,/participant-export\/client-adapter|抽選番号/);
});

test('Koga peach festival loading and violet card button honor reduced motion',()=>{
 assert.match(ui,/meetup-roster-button/);
 assert.match(ui,/roster-peach-loading/);
 assert.match(ui,/button\.textContent='名簿を準備中'/);
 assert.doesNotMatch(ui,/古河の桃まつりをイメージした花びらが舞っています/);
 assert.match(ui,/linear-gradient\(118deg,#6232bb/);
 assert.match(ui,/prefers-reduced-motion:reduce/);
 assert.match(ui,/参加表明者を含む3列で出力/);
});

test('15-second shared cooldown and truthful download status',()=>{
 assert.match(ui,/const COOLDOWN_MS=15000/);
 assert.match(ui,/const controls=new Set\(\)/);
 assert.match(ui,/response\.status===200\|\|response\.status===429/);
 assert.match(ui,/Date\.now\(\)<cooldownUntil/);
 assert.match(ui,/再試行まであと/);
 assert.match(ui,/ダウンロードしました/);
 assert.doesNotMatch(ui,/CSVの保存を開始しました/);
});
test('mobile download help stays short and cannot claim to open OS folders',()=>{
 assert.match(ui,/📁 保存したファイルを探す/);
 assert.match(ui,/iPhone\|iPad\|iPod/);
 assert.match(ui,/Android/);
 assert.match(ui,/ブラウザのダウンロード履歴/);
 assert.match(ui,/guide\.hidden=false/);
 assert.match(ui,/hint\.hidden=!hint\.hidden/);
});

test('Meetup card footer is stable while loading, cooling down and showing file help',()=>{
 assert.match(ui,/grid-template-rows:40px 22px 26px/);
 assert.match(ui,/min-height:96px;height:96px/);
 assert.match(ui,/white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
 assert.match(ui,/roster-location-hint\{position:absolute/);
 assert.doesNotMatch(ui,/participant-roster-action\{display:flex/);
});

test('429 clearly explains hourly limit and does not promise download after 15 seconds',()=>{
 assert.match(ui,/取得制限中：15秒間隔・1時間12回まで/);
 assert.match(ui,/再試行まであと/);
 assert.doesNotMatch(ui,/再取得まであと/);
 assert.match(ui,/if\(response\.status===429\)beginCooldown|response\.status===200\|\|response\.status===429/);
});

test('in-memory reuse only, short TTL, scoped to user and Meetup, no server call',()=>{
 assert.match(ui,/const MEMORY_TTL_MS=5\*60\*1000/);
 assert.match(ui,/cachedRoster\.userId!==userId/);
 assert.match(ui,/cachedRoster\.meetupId===meetupId/);
 assert.match(ui,/expiresAt:Date\.now\(\)\+MEMORY_TTL_MS/);
 assert.match(ui,/previous\.blob,meetup\.id/);
 assert.match(ui,/client\.auth\.getSession\(\)/);
 assert.match(ui,/client\.from\('profiles'\)/);
 assert.match(ui,/roleCheck\.data\.role==='ca'/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB|caches\.open/);
});
test('resave action shares fixed layout with save location and remains separate from server cooldown',()=>{
 assert.match(ui,/もう一度保存/);
 assert.match(ui,/roster-secondary-actions/);
 assert.match(ui,/grid-row:3/);
 assert.match(ui,/saveRosterBlob\(previous\.blob,meetup\.id\)/);
 assert.match(ui,/const previous=currentCached\(userId,meetup\.id\)/);
});

test('Peach flowers animate on all CSV buttons, not only during loading',()=>{
 assert.match(ui,/\.meetup-roster-button::before,\.meetup-roster-button::after/);
 assert.match(ui,/animation:roster-peach-fall 3\.6s/);
 assert.match(ui,/z-index:-1;pointer-events:none/);
 assert.match(ui,/\.meetup-roster-button\.roster-peach-loading::before/);
 assert.match(ui,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(ui,/\.meetup-roster-button\.roster-peach-loading::before,\.meetup-roster-button\.roster-peach-loading::after\{/);
});
