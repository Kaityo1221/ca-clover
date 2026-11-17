/**
 * Cost- and privacy-first preflight for a future schema-only Neon branch.
 * NO API calls, database connections, mutations, or secret handling.
 * All metadata MUST originate from a trusted Neon API response outside untrusted PR code.
 */
import { QA_PROJECT_ID, QA_PROJECT_NAME } from './clover-neon-qa-gate.mjs';

export const NO_NEW_CHARGE_BRANCH_CAP = 10;
export const NO_NEW_CHARGE_ROOT_CAP = 3;

export function assessNeonBranchCapacity(project, branches) {
  const deny = reason => ({ allowed: false, reason, recommendedAction: 'STOP_NO_GO' });
  if (!project || project.id !== QA_PROJECT_ID || project.name !== QA_PROJECT_NAME)
    return deny('project mismatch');
  if (!Array.isArray(branches) || !branches.length)
    return deny('missing/unverified complete branch listing');
  if (branches.some(b => !b || b.project_id !== QA_PROJECT_ID || typeof b.id !== 'string'))
    return deny('branch belongs to unexpected project or lacks ID');
  if (new Set(branches.map(b => b.id)).size !== branches.length)
    return deny('duplicate branch IDs: incomplete/noncanonical listing');
  // A plan upgrade is not allowed, even if the account happens to be paid.
  // Fail closed at Free-tier published ceilings; never delete existing branches.
  if (branches.length >= NO_NEW_CHARGE_BRANCH_CAP)
    return deny('no free-tier branch capacity; deletion/upgrade not authorized');
  const roots = branches.filter(b => b.parent_id == null);
  if (roots.length >= NO_NEW_CHARGE_ROOT_CAP)
    return deny('no free-tier root branch capacity for schema-only branch');
  if (branches.some(b => typeof b.name === 'string' && b.name.startsWith('clover-qa-')))
    return deny('existing QA-scoped branches require independent review');
  return {
    allowed: true,
    reason: 'capacity-only preflight; creation and data isolation still NOT authorized',
    branchCount: branches.length,
    rootCount: roots.length,
    recommendedAction: 'REVIEW_ONLY',
  };
}
