// Copy this file to discord-test-config.js ONLY on the isolated staging site.
// NEVER supply service role keys, Discord Client Secret, or personal access tokens.
// Example values below are placeholders and deliberately nonfunctional.
window.CA_CLOVER_DISCORD_TEST_CONFIG = {
  supabaseUrl: "https://YOUR-ISOLATED-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-STAGING-PUBLISHABLE-KEY",
  redirectUri: "https://YOUR-STAGING-SITE.example/discord-oauth-test.html",
};
