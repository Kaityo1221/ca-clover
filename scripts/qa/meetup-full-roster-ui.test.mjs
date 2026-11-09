import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const component=readFileSync('src/components/meetup-full-roster-export.tsx','utf8');
const page=readFileSync('src/app/community/[id]/page.tsx','utf8');
test('export button is deliberately disabled until backend auth and audit',()=>{
  assert.match(component,/const available = false;/);
  assert.match(component,/disabled=\{!canExport \|\| !meetupId\}/);
  assert.doesNotMatch(component,/fetch\s*\(|functions\.invoke\s*\(/);
  assert.match(page,/MeetupFullRosterExport meetupId=\{selectedMeetup\.id\} enabled=\{false\}/);
});
