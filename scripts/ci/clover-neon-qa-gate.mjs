/**
 * Neon QA target gate: metadata-only, NO connection and NO resource creation.
 * This protects planning; it does not authorize running migrations.
 */
export const QA_PROJECT_ID = 'still-hill-22136867';
export const QA_PROJECT_NAME = 'ca-clover-test';
export const BRANCH_PREFIX = 'clover-qa-';
export function validateQaTarget(target) {
  const reject = reason => ({ permitted: false, reason });
  if (!target || typeof target !== 'object') return reject('missing target');
  if (target.projectId !== QA_PROJECT_ID || target.projectName !== QA_PROJECT_NAME)
    return reject('project not in isolated QA allowlist');
  if (typeof target.branchName !== 'string' || !/^clover-qa-[a-z0-9-]{8,70}$/.test(target.branchName))
    return reject('invalid QA branch namespace');
  if (target.branchName === 'main' || target.isDefaultBranch !== false)
    return reject('default branch denied');
  if (target.branchMode !== 'schema-only' || target.copyUserData !== false)
    return reject('only schema-only without user data allowed');
  if (target.fixtures !== 'synthetic' || target.authUsers !== 'synthetic')
    return reject('only synthetic data/users allowed');
  if (target.productionCredentialsPresent !== false || target.externalEffectsDisabled !== true)
    return reject('production credentials or external effects not proven absent');
  if (target.expirationHours !== 24)
    return reject('24-hour expiry required');
  return { permitted: true, reason: 'metadata validated; no connection authorized' };
}
