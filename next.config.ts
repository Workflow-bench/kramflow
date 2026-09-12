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
};

export default nextConfig;
