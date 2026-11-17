/**
 * Deterministic, OFFLINE schema-only Neon CLI plan.
 * Does not invoke CLI, log secrets, connect to Neon, or create branches.
 * This plan is not authorization to execute: server metadata, row counts,
 * auth isolation and external side effects still require separate checks.
 */
import { validateQaTarget, QA_PROJECT_ID, QA_PROJECT_NAME } from './clover-neon-qa-gate.mjs';

export const QA_PARENT_BRANCH_ID = 'br-flat-dust-b4vc28pb';
const DAY_MS = 24 * 60 * 60 * 1000;

export function planSchemaOnlyBranch({ branchName, now, parentBranchId = QA_PARENT_BRANCH_ID } = {}) {
  const reject = reason => ({ ready: false, reason, command: null, args: null });
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return reject('invalid clock');
  if (parentBranchId !== QA_PARENT_BRANCH_ID) return reject('unexpected parent branch');
  const gate = validateQaTarget({
    projectId: QA_PROJECT_ID,
    projectName: QA_PROJECT_NAME,
    branchName,
    isDefaultBranch: false,
    branchMode: 'schema-only',
    copyUserData: false,
    fixtures: 'synthetic',
    authUsers: 'synthetic',
    productionCredentialsPresent: false,
    externalEffectsDisabled: true,
    expirationHours: 24,
  });
  if (!gate.permitted) return reject(gate.reason);
  const expiresAt = new Date(now.getTime() + DAY_MS).toISOString();
  const args = [
    'branches', 'create',
    '--project-id', QA_PROJECT_ID,
    '--name', branchName,
    '--parent', parentBranchId,
    '--schema-only',
    '--expires-at', expiresAt,
  ];
  return {
    ready: true,
    mode: 'OFFLINE_PLAN_ONLY',
    projectId: QA_PROJECT_ID,
    parentBranchId,
    branchName,
    expiresAt,
    command: 'neon',
    args,
    requiresHumanReview: true,
    refusesExecution: true,
    unverified: ['server-side schema-only support and metadata shape',
      'row counts', 'Auth isolation', 'free quota', 'external effects'],
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  console.error('CLOVER_NEON_SCHEMA_PLAN_ONLY: executable entry point disabled; import for offline tests only');
  process.exit(12);
}
