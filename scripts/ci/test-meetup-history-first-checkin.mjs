import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFirstCheckinResponse,firstCheckinLabel,APPROVED_FIRST_CHECKIN_URL} from '../../docs/meetup-first-checkin-ui.mjs';
import {FIRST_CHECKIN_ENDPOINT} from '../../docs/meetup-first-checkin-config.mjs';
import {readFileSync} from 'node:fs';
const one='00000000-0000-4000-8000-000000000001';
const two='00000000-0000-4000-8000-000000000002';
test('default endpoint must stay disabled',()=>{
  assert.equal(FIRST_CHECKIN_ENDPOINT,'');
  assert.match(APPROVED_FIRST_CHECKIN_URL,/^https:\/\/wgiittrvgtiosogyhfcl\.supabase\.co\//);
});
test('verified values including 0 use proper label',()=>{
  const model=normalizeFirstCheckinResponse({version:1,status:'verified',
    asOf:'2026-11-14T00:00:00Z',counts:{[one]:0,[two]:3}},[one,two]);
  assert.equal(model.status,'verified');
  assert.equal(firstCheckinLabel(model,one),'初チェックイン 0人');
  assert.equal(firstCheckinLabel(model,two),'初チェックイン 3人');
});
test('incomplete history never displays false zero',()=>{
  const model=normalizeFirstCheckinResponse({version:1,status:'insufficient_history',
    counts:{[one]:0}},[one]);
  assert.equal(model.counts,null);
  assert.equal(firstCheckinLabel(model,one),'初チェックイン 履歴不足');
});
test('missing verified meetup count is unknown, not zero',()=>{
  const model=normalizeFirstCheckinResponse({version:1,status:'verified',
    asOf:'2026-11-14T00:00:00Z',counts:{[one]:4}},[one,two]);
  assert.equal(firstCheckinLabel(model,two),'初チェックイン —');
});
test('malformed response and invalid counts fail closed',()=>{
  const bad=[
    {version:1,status:'verified',asOf:'bad',counts:{[one]:0}},
    {version:1,status:'verified',asOf:'2026-11-14T00:00:00Z',counts:{[one]:-1}},
    {version:1,status:'verified',asOf:'2026-11-14T00:00:00Z',counts:{[one]:'3'}},
    {version:1,status:'verified',asOf:'2026-11-14T00:00:00Z',counts:{[one]:100000}},
    {version:1,status:'something',counts:{[one]:2}}
  ];
  for(const body of bad)assert.equal(normalizeFirstCheckinResponse(body,[one]).status,'unavailable');
});
test('history card insertion and render cleanup are wired only in candidate',()=>{
  const html=readFileSync(new URL('../../docs/index.html',import.meta.url),'utf8');
  assert.match(html,/const firstCheckinReady=Promise\.all\(/);
  assert.match(html,/mountFirstCheckins\(/);
  assert.equal((html.match(/if\(firstCheckinLeave\)\{/g)||[]).length,2);
});
