import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The landing page's product captures are dense UI screenshots whose
    // small type falls apart at the default quality. Next 16 only permits
    // qualities listed here, so an unlisted `quality` prop silently falls
    // back to 75 (confirmed: the optimizer was serving q=75 despite
    // quality={90}).
    qualities: [75, 90],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN, not DENY: the Displays page previews a screen in a
          // same-origin iframe, which DENY blocks (the dialog rendered blank).
          // Other sites still cannot frame KramFlow.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
