import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Silence Turbopack's workspace-root guess: a sibling pnpm-workspace.yaml isn't ours.
  turbopack: { root: process.cwd() },
  // Baseline headers now; strict CSP and rate limiting land in Phase 13 (hardening).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          // camera/microphone scoped to our own origin — video calls (case Discussion) need them;
          // geolocation stays fully blocked since nothing in the app uses it.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
