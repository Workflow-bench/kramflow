/**
 * Open Graph values for noindex, private routes (KF-026).
 *
 * A child layout's `openGraph` replaces the root object wholesale (Next merges
 * metadata shallowly). Without this, every private page inherits the root
 * `og:url` (the public homepage) and the root image. These pages carry only the
 * static brand title and site name: no `url`, no image, no route parameter.
 */
export const PRIVATE_OPEN_GRAPH = {
  title: "KramFlow",
  siteName: "KramFlow",
  type: "website" as const,
};
