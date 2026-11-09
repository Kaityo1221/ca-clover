import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const component=readFileSync('src/components/meetup-full-roster-export.tsx','utf8');
const page=readFileSync('src/app/community/[id]/page.tsx','utf8');
test('export cannot run unless both preview/build and component gates are true',()=>{
 assert.match(component,/const approvedAtBuild=process\.env\.NEXT_PUBLIC_CA_MEETUP_ROSTER_EXPORT_ENABLED==="true"/);
 assert.match(component,/const canExport=approvedAtBuild&&enabled&&!busy/);
 assert.match(component,/if\(!canExport\|\|!meetupId\)return/);
 assert.match(page,/enabled=\{process\.env\.NEXT_PUBLIC_CA_MEETUP_ROSTER_EXPORT_ENABLED==="true"\}/);
});
test('no service credential or arbitrary endpoint in browser',()=>{
 assert.match(component,/supabase\.auth\.getSession\(\)/);
 assert.match(component,/supabase\.supabaseUrl/);
 assert.doesNotMatch(component,/SERVICE_ROLE|service_role|niantic-social-api/);
 assert.match(component,/response\.headers\.get\("content-type"\)/);
 assert.match(component,/URL\.revokeObjectURL/);
});
