import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('docs/meetup-roster-ui.mjs','utf8');
const page=readFileSync('docs/index.html','utf8');
test('roster UI lives separately from existing raffle/checkin export',()=>{
 assert.match(page,/rosterReady=import\('\.\/meetup-roster-ui\.mjs/);
 assert.match(page,/mountRosterButton\(\{root:back,meetup:m/);
 assert.match(page,/participant-export-ui\.mjs/);
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

test('D permission missing remains visibly explained and export disabled',()=>{
 assert.match(ui,/button\.disabled=!hasD/);
 assert.match(ui,/if\(!hasD\|\|inFlight/);
 assert.match(ui,/管理者も対象です/);
 assert.match(page,/meetup-roster-ui\.mjs\?v=20261110-permission2/);
});
