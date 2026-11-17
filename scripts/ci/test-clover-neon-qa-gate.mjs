import assert from 'node:assert/strict';
import { validateQaTarget, validateServerBranch, QA_PROJECT_ID, QA_PROJECT_NAME } from './clover-neon-qa-gate.mjs';

const safe = {
  projectId: QA_PROJECT_ID, projectName: QA_PROJECT_NAME,
  branchName: 'clover-qa-pr325-20261117', branchMode: 'schema-only',
  isDefaultBranch: false, copyUserData: false,
  fixtures: 'synthetic', authUsers: 'synthetic',
  productionCredentialsPresent: false, externalEffectsDisabled: true,
  expirationHours: 24,
};
assert.equal(validateQaTarget(safe).permitted, true, 'valid isolated metadata should pass');
const bad = [
  ['different project', { projectId: 'silent-sea-07101633' }],
  ['name mismatch', { projectName: 'untrusted' }],
  ['default branch', { branchName: 'main', isDefaultBranch: true }],
  ['unprefixed branch', { branchName: 'preview-feature' }],
  ['data clone', { branchMode: 'parent-data', copyUserData: true }],
  ['copy rows', { copyUserData: true }],
  ['real fixtures', { fixtures: 'production' }],
  ['real auth users', { authUsers: 'production' }],
  ['production credential', { productionCredentialsPresent: true }],
  ['outbound side effects', { externalEffectsDisabled: false }],
  ['no expiry', { expirationHours: 0 }],
  ['wrong expiry', { expirationHours: 48 }],
];
for (const [name, override] of bad) {
  assert.equal(validateQaTarget({ ...safe, ...override }).permitted, false, name);
}
assert.equal(validateQaTarget(null).permitted, false);
console.log('CLOVER_NEON_QA_METADATA_GATE_PASS: allow=1 deny=' + (bad.length + 1) + '; NO DB connections');

const apiProject = { id: QA_PROJECT_ID, name: QA_PROJECT_NAME };
const now = new Date('2026-11-17T09:00:00Z');
const expiry = new Date(now.getTime() + 24 * 3600 * 1000);
const serverBranch = {
  project_id: QA_PROJECT_ID,
  name: 'clover-qa-pr325-20261117',
  default: false, protected: false,
  parent_id: null, init_source: 'schema-only',
  created_at: now.toISOString(), expires_at: expiry.toISOString(),
};
assert.equal(validateServerBranch(apiProject, serverBranch).permitted, true);
for(const init_source of ['schema','schema-only','parent-schema']) {
  assert.equal(validateServerBranch(apiProject, {...serverBranch,init_source}).permitted, true, init_source);
  assert.equal(validateServerBranch(apiProject, {...serverBranch,init_source,parent_id:'br-flat-dust-b4vc28pb'}).permitted, false, init_source + ' with parent');
}
const badServerBranches = [
  ['live project', { project_id: 'silent-sea-07101633' }],
  ['default', { default: true }],
  ['protected', { protected: true }],
  ['parent data', { parent_id: 'br-flat-dust-b4vc28pb', init_source: 'parent-data' }],
  ['unknown init source', { init_source: 'unknown' }],
  ['no expiry', { expires_at: undefined }],
  ['too long', { expires_at: '2026-11-20T09:00:00Z' }],
  ['wrong name', { name: 'main' }],
];
for (const [name, override] of badServerBranches) {
  assert.equal(validateServerBranch(apiProject, { ...serverBranch, ...override }).permitted, false, name);
}
assert.equal(validateServerBranch({ ...apiProject, name: 'ca-clover-zoroark-prod' }, serverBranch).permitted, false);
console.log('CLOVER_NEON_SERVER_METADATA_PASS: synthetic API responses only; no Neon branch created');
