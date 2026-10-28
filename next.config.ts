import type { NextConfig } from "next";

/**
 * Canonical user-facing CA Clover is GitHub Pages from the 'pages/docs' branch.
 * Vercel remains the backend for /api/* and specialized dynamic server routes.
 * Keep these exact, non-permanent redirects scoped to known canonical UI routes.
 * Never add a catch-all: that would intercept authenticated API and asset routes.
 */
const CANONICAL = "https://kaityo1221.github.io/ca-clover/";

const nextConfig: NextConfig = {
  async redirects() {
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
