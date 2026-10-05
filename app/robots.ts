import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      // Noindex pages stay crawlable so crawlers can read their noindex meta
      // (KF-026): /invite/ carries noindex and is not disallowed. Disallow only
      // private routes that redirect to login (their noindex is never served
      // to a crawler anyway) and the API. /dev/ is a 404 in production.
      disallow: ["/dashboard", "/e/", "/api/"],
    },
  };
}
