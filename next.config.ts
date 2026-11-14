import type { NextConfig } from "next";

/**
 * Canonical user-facing CA Clover is GitHub Pages from the 'pages/docs' branch.
 * Vercel remains the backend for /api/* and specialized dynamic server routes.
 * Keep these exact, non-permanent redirects scoped to known canonical UI routes.
 * Never add a catch-all: that would intercept authenticated API and asset routes.
 */
const CANONICAL = "https://kaityo1221.github.io/ca-clover/";
// Existing production and other previews retain their canonical redirects.
const claimPreview = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/claim-discord-apac-ui-isolated-20261114";

const nextConfig: NextConfig = {
  env: {
    // Derive from the platform; a shared public variable must not label a
    // Preview build as production and bypass browser connection selection.
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
    NEXT_PUBLIC_CA_CLOVER_CLAIM_PREVIEW: claimPreview ? "true" : "false",
  },
  async headers() {
    return [{source: "/discord-ca/callback", headers: [
      {key: "Referrer-Policy", value: "no-referrer"},
      {key: "Cache-Control", value: "no-store"},
      {key: "X-Robots-Tag", value: "noindex, nofollow"},
    ]}];
  },
  async redirects() {
    if (claimPreview) return [];
    return [
      { source: "/", destination: CANONICAL, permanent: false },
      { source: "/login", destination: CANONICAL, permanent: false },
      { source: "/my", destination: CANONICAL + "#my", permanent: false },
      { source: "/account", destination: CANONICAL + "#account", permanent: false },
      { source: "/mini-games", destination: CANONICAL + "#mini-games", permanent: false },
      { source: "/mini-games/zoroark", destination: CANONICAL + "#mini-games", permanent: false },
    ];
  },
};
export default nextConfig;

