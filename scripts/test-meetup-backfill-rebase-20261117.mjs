// Read-only static safety checks; no browser, Auth or Edge invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../docs/admin.html',import.meta.url),'utf8');
test('new menu and route are registered once',()=>{
 assert.equal((page.match(/\["meetup-backfill","🧩"/g)||[]).length,1);
 assert.equal((page.match(/if\(r==="meetup-backfill"\)return meetupBackfill\(\)/g)||[]).length,1);
});
test('registration is disabled even if a server claims writable',()=>{
 assert.match(page,/const FRONTEND_BACKFILL_WRITE_GATE=false/);
 assert.match(page,/const canCommit=FRONTEND_BACKFILL_WRITE_GATE&&data\.canSave===true/);
 assert.match(page,/if\(canCommit && commitButton\)/);
});
test('preview validates allowed Campfire HTTPS origins and response shape',()=>{
 assert.match(page,/parsed\.protocol!=="https:"/);
 assert.match(page,/campfire\.scopely\.com/);
 assert.match(page,/data\.registrationContract==="atomic-audit-v1"/);
});
test('existing ADMIN route and current home scripts are retained',()=>{
 assert.match(page,/if\(r==="account-audit"\)return accountAudit\(\)/);
 assert.match(page,/clover-global-home\.js\?v=20261113-home1/);
});
