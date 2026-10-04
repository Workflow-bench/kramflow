import type { Metadata } from "next";

// Developer component catalog. Not a product page and not for search.
export const metadata: Metadata = {
  title: "Component catalog",
  robots: { index: false, follow: false },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
