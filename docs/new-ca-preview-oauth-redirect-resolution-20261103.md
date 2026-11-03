# Preview Google OAuth redirect recovery (2026-11-03)

On iPhone, Google sign-in from the CA Clover Vercel preview returned to GitHub Pages production. The login code already sets redirectTo to window.location.origin plus the requested path. Supabase Auth requires a matching URL in its Redirect URLs allowlist.

## Required exact redirect URL
https://ca-clover-git-feature-new-ca-approval-admin-p-b89264-kaityo1222.vercel.app/admin/new-ca

Optionally for future pending applicant testing:
https://ca-clover-git-feature-new-ca-approval-admin-p-b89264-kaityo1222.vercel.app/new-ca/link

1. In Supabase Auth > URL Configuration, add ONLY the exact preview URLs above to Redirect URLs. Do not modify the Site URL, OAuth Google provider, production login, or existing CA accounts.
2. Verify the allowlist entry and change the Vercel environment NEXT_PUBLIC_NEW_CA_PREVIEW_OAUTH_READY to true ONLY on the feature/new-ca-approval-admin-preview-20261103 preview branch. Redeploy that preview.
3. On iPhone, retry /admin/new-ca, verify the address bar remains on the exact preview origin, and verify a server-validated GoTrue ADMIN session plus isolated Neon GET.

OAuth remains disabled until NEXT_PUBLIC_NEW_CA_PREVIEW_OAUTH_READY is explicitly set. The connected Supabase tools do not expose Auth Redirect URLs updates, so manual console configuration is still pending. Do not claim E2E PASS before the iPhone test.

Reference https://supabase.com/docs/guides/auth/redirect-urls

Status: CODE READY / CONSOLE REDIRECT SETTING BLOCKED / PRODUCTION NO-GO.