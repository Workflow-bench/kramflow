import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      // Noindex routes stay crawlable so crawlers can read their noindex meta;
      // robots disallow only covers private/authenticated paths.
      disallow: [
        "/dashboard",
        "/e/",
        "/invite/",
        "/api/",
        "/dev/",
      ],
    },
  };
}
