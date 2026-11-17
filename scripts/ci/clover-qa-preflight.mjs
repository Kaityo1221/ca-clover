/** Clover QA v1 fail-closed credential/connection guard; defense in depth only. */
const forbidden = [
  /^(?:DATABASE_URL|DIRECT_URL|POSTGRES(?:QL)?(?:_URL|_HOST|_USER|_PASSWORD)?|PG(?:HOST|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE))$/i,
  /^(?:SUPABASE|NEON|DISCORD|CLOUDFLARE|CF_|VERCEL|GOOGLE_CLIENT|GOOGLE_OAUTH|CAMPFIRE|SCOPELY|DATABASE_)/i,
  /^(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GH_TOKEN|GITHUB_TOKEN|OPENAI_API_KEY)$/i,
];
const detected = Object.keys(process.env).filter(key => forbidden.some(pattern => pattern.test(key)));
if (detected.length) {
  // Never print credential values or even names.
  console.error('CLOVER_QA_PREFLIGHT_DENIED: ' + detected.length + ' disallowed service environment variables present');
  process.exit(12);
}
if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true') {
  console.error('CLOVER_QA_PREFLIGHT_DENIED: unexpected runner environment');
  process.exit(13);
}
console.log('CLOVER_QA_PREFLIGHT_PASS: forbidden connection/credential env absent; CI runner confirmed');
