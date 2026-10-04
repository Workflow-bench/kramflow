import type { MetadataRoute } from "next";

const BASE_URL = "https://www.kramflow.me";

// Indexable public routes only. Login and signup are noindex (layouts), so they
// are not listed here.
// Everything else (dashboard, events, invites, display surfaces, /dev) is
// authenticated or internal and stays out of both files together.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
  ];
}
