import type { MetadataRoute } from "next";

const BASE_URL = "https://www.kramflow.me";

// Public marketing/auth routes only — matches robots.ts's `allow` list.
// Everything else (dashboard, events, invites, display surfaces, /dev) is
// authenticated or internal and stays out of both files together.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/signup`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
