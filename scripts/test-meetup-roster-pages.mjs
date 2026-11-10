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
 assert.match(page,/meetup-roster-ui\.mjs\?v=20261110-card1/);
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
