import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The landing page's product captures are dense UI screenshots whose
    // small type falls apart at the default quality. Next 16 only permits
    // qualities listed here, so an unlisted `quality` prop silently falls
    // back to 75 (confirmed: the optimizer was serving q=75 despite
    // quality={90}).
    // 80 is listed because the product shots use it (components/site/product-shot.tsx).
    // An unlisted quality falls back to 75 without a warning.
    qualities: [75, 80, 90],
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
          // Report-Only: a violation is logged in the browser console and sent to
          // any report endpoint, but nothing is blocked. Enforcement needs
          // evidence from this header first (docs/audit-remediation/SECURITY_OPS_PLAN.md).
          // script-src keeps 'unsafe-inline' and 'unsafe-eval' because the Next.js
          // runtime needs them today; a nonce would need middleware changes.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-src 'self'",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
