import assert from 'node:assert/strict';
import { assessNeonBranchCapacity } from './clover-neon-capacity-gate.mjs';
import { QA_PROJECT_ID, QA_PROJECT_NAME } from './clover-neon-qa-gate.mjs';

const project = { id: QA_PROJECT_ID, name: QA_PROJECT_NAME };
const make = (count, rootCount = 1) => Array.from({ length: count }, (_, i) => ({
  id: 'br-synthetic-' + i,
  project_id: QA_PROJECT_ID,
  name: i === 0 ? 'main' : 'synthetic-' + i,
  parent_id: i < rootCount ? null : 'br-synthetic-0',
}));
const pass = assessNeonBranchCapacity(project, make(9));
assert.equal(pass.allowed, true);
assert.equal(pass.recommendedAction, 'REVIEW_ONLY');
const cases = [
  ['full free cap', project, make(10)],
  ['over cap', project, make(11)],
  ['root cap', project, make(9, 3)],
  ['project swapped', { id: 'silent-sea-07101633', name: QA_PROJECT_NAME }, make(9)],
  ['project name swapped', { id: QA_PROJECT_ID, name: 'other' }, make(9)],
  ['missing list', project, undefined],
  ['empty list', project, []],
  ['foreign branch', project, [{ ...make(9)[0], project_id: 'silent-sea-07101633' }]],
  ['duplicate ids', project, [...make(8), make(8)[0]]],
  ['existing qa branch', project, make(9).map((b,i) => i===1 ? { ...b, name:'clover-qa-older-20261116' } : b)],
];
for(const [name, p, branches] of cases){
  const result=assessNeonBranchCapacity(p, branches);
  assert.equal(result.allowed, false, name);
  assert.equal(result.recommendedAction, 'STOP_NO_GO', name);
}
console.log('CLOVER_NEON_CAPACITY_GUARD_PASS: 1 allowed metadata shape, ' + cases.length + ' deny cases; no API/DB calls');
