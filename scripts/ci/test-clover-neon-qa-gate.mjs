import assert from 'node:assert/strict';
import { validateQaTarget, QA_PROJECT_ID, QA_PROJECT_NAME } from './clover-neon-qa-gate.mjs';

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
