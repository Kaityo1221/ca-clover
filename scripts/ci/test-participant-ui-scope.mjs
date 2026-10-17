import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
const manifest=JSON.parse(read('scripts/ci/participant-protected-scope.json'));
test('index existing behavior unchanged outside explicit CSV and card metrics integration hooks',()=>{
 let source=read('docs/index.html');
 source=source.replace(/  \/\/ PARTICIPANT_CSV_IMPORT_BEGIN\n[\s\S]*?  \/\/ PARTICIPANT_CSV_IMPORT_END\n/,'');
 source=source.replace(/    \/\/ PARTICIPANT_CSV_MOUNT_BEGIN\n[\s\S]*?    \/\/ PARTICIPANT_CSV_MOUNT_END\n/,'');
 source=source.replace(/    if\(participantPanel\)participantPanel.leave\(\); \/\/ PARTICIPANT_CSV_LEAVE\n/,'');
 source=source.replace(/  \/\/ CARD_METRICS_IMPORT_BEGIN\n[\s\S]*?  \/\/ CARD_METRICS_IMPORT_END\n/,'');
 source=source.replace(/    \/\/ CARD_METRICS_(?:APPLY|DETAIL)_BEGIN\n[\s\S]*?    \/\/ CARD_METRICS_(?:APPLY|DETAIL)_END\n/g,'');
 source=source.replace(/    \/\/ CARD_METRICS_FIELDS_BEGIN\n[\s\S]*?    \/\/ CARD_METRICS_FIELDS_END\n/,'    const meetupFields="id,title,starts_at,ends_at,location,event_url,details,is_ca_meetup,rsvp_count,checkin_count,campfire_live_event_name";\n');
 const hash=createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0').update(source).digest('hex');assert.equal(hash,manifest.indexBlob);
});
test('all original ADMIN/medal/auth files untouched and all additions within reviewed scope',()=>{
 const entries=execFileSync('git',['ls-tree','-r','HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]]});
 const actual=new Map(entries);
 for(const [path,sha] of Object.entries(manifest.protectedBlobs))assert.equal(actual.get(path),sha,path);
 const added=new Set(['docs/meetup-metrics.mjs','scripts/ci/test-meetup-metrics.mjs','docs/participant-export-ui.mjs','docs/participant-export/client-adapter.mjs','docs/participant-export/csv-click-guard.mjs','docs/participant-export/engine-policy.mjs',
  '.github/workflows/participant-csv-ui-tests.yml','scripts/ci/test-participant-ui-webkit.mjs','scripts/ci/test-participant-ui-scope.mjs','scripts/ci/participant-protected-scope.json',
  'scripts/ci/participant-runtime/package.json','scripts/ci/participant-runtime/package-lock.json','docs/PARTICIPANT-CSV-UI-RELEASE-20261017.md']);
 for(const path of actual.keys())assert(path==='docs/index.html'||Object.hasOwn(manifest.protectedBlobs,path)||added.has(path),path);
});
test('public modules contain no upstream, service key, signing key or roster storage',()=>{
 for(const p of ['docs/meetup-metrics.mjs','docs/participant-export-ui.mjs','docs/participant-export/client-adapter.mjs','docs/participant-export/csv-click-guard.mjs','docs/participant-export/engine-policy.mjs']){
  const code=read(p);assert(!/niantic-social-api|service_role|SERVICE_ROLE|DRAW_KEYS|keyBytes|localStorage|sessionStorage|indexedDB|console\.(log|error)/.test(code),p);
 }
});
