import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

// Developer component catalog. Not a product page and not for search.
export const metadata: Metadata = {
  title: "Component catalog",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
