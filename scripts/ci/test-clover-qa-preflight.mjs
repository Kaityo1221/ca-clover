import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('./clover-qa-preflight.mjs', import.meta.url));
// Synthetic environment: never inherit secrets from the parent.
const baseline = { CI: 'true', GITHUB_ACTIONS: 'true', PATH: process.env.PATH ?? '' };
const cases = [
  { name: 'clean', env: {}, expected: 0 },
  { name: 'database-url', env: { DATABASE_URL: 'postgres://test.invalid/db' }, expected: 12 },
  { name: 'neon', env: { NEON_DATABASE_URL: 'postgres://test.invalid/db' }, expected: 12 },
  { name: 'supabase', env: { SUPABASE_URL: 'https://test.invalid' }, expected: 12 },
  { name: 'discord', env: { DISCORD_BOT_TOKEN: 'dummy' }, expected: 12 },
  { name: 'google', env: { GOOGLE_CLIENT_SECRET: 'dummy' }, expected: 12 },
  { name: 'vercel', env: { VERCEL_TOKEN: 'dummy' }, expected: 12 },
  { name: 'not-ci', env: { GITHUB_ACTIONS: 'false' }, expected: 13 },
];
for (const item of cases) {
  const run = spawnSync(process.execPath, [target], { encoding: 'utf8', env: { ...baseline, ...item.env } });
  if (run.status !== item.expected || run.error || (run.stdout + run.stderr).includes('dummy') || (run.stdout + run.stderr).includes('test.invalid')) {
    console.error('CLOVER_QA_GUARD_TEST_FAIL: ' + item.name);
    process.exit(1);
  }
}
console.log('CLOVER_QA_GUARD_NEGATIVE_PASS: ' + cases.length + ' expected outcomes; no credential values echoed');
