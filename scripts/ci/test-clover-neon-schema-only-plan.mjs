import assert from 'node:assert/strict';
import { planSchemaOnlyBranch, QA_PARENT_BRANCH_ID } from './clover-neon-schema-only-plan.mjs';
import { QA_PROJECT_ID } from './clover-neon-qa-gate.mjs';

const at = new Date('2026-11-17T09:00:00.000Z');
const good = planSchemaOnlyBranch({ branchName: 'clover-qa-pr325-20261117', now: at });
assert.equal(good.ready, true);
assert.equal(good.mode, 'OFFLINE_PLAN_ONLY');
assert.equal(good.refusesExecution, true);
assert.equal(good.requiresHumanReview, true);
assert.equal(good.command, 'neon');
assert.equal(good.expiresAt, '2026-11-18T09:00:00.000Z');
assert.deepEqual(good.args, [
  'branches', 'create', '--project-id', QA_PROJECT_ID,
  '--name', 'clover-qa-pr325-20261117',
  '--parent', QA_PARENT_BRANCH_ID,
  '--schema-only', '--expires-at', good.expiresAt,
]);
assert.equal(good.args.filter(arg => arg === '--schema-only').length, 1);
for (const bad of [
  { branchName: 'main', now: at },
  { branchName: 'clover-qa-pr325-20261117;echo-hacked', now: at },
  { branchName: 'clover-qa-pr325-20261117', now: new Date('invalid') },
  { branchName: 'clover-qa-pr325-20261117', now: at, parentBranchId: 'br-prod' },
  { branchName: 'clover-qa-pr325-20261117', now: at, parentBranchId: '' },
]) {
  const outcome = planSchemaOnlyBranch(bad);
  assert.equal(outcome.ready, false);
  assert.equal(outcome.args, null);
}
console.log('CLOVER_NEON_SCHEMA_ONLY_PLAN_PASS: offline planned create, 5 rejection cases; no API/CLI invoked');
