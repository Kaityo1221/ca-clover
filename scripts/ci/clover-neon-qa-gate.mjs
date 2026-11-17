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

/**
 * Only verified server-returned branch metadata may advance to data verification.
 * This does NOT prove row count, Auth emptiness or external egress isolation.
 */
export function validateServerBranch(project, branch) {
  const reject = reason => ({ permitted: false, reason });
  if (project?.id !== QA_PROJECT_ID || project?.name !== QA_PROJECT_NAME)
    return reject('Neon server project metadata mismatch');
  if (branch?.project_id !== project.id)
    return reject('Neon server branch project mismatch');
  if (typeof branch.name !== 'string' || !/^clover-qa-[a-z0-9-]{8,70}$/.test(branch.name))
    return reject('Neon server branch is not QA-scoped');
  if (branch.default !== false || branch.protected !== false)
    return reject('default or protected branch forbidden');
  if (branch.parent_id != null)
    return reject('parent-data branches forbidden; require independent schema-only root');
  // Never trust a caller-supplied branchMode in place of Neon API metadata.
  if (branch.init_source !== 'schema-only')
    return reject('schema-only branch not verified from Neon metadata');
  if (typeof branch.expires_at !== 'string' || !Number.isFinite(Date.parse(branch.expires_at)))
    return reject('missing server-confirmed expiration');
  const ttl = Date.parse(branch.expires_at) - Date.parse(branch.created_at);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 24 * 60 * 60 * 1000)
    return reject('server-confirmed expiry must be within 24h of creation');
  return { permitted: true, reason: 'server metadata accepted; DB rows/Auth remain UNVERIFIED' };
}
