import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

export const metadata: Metadata = {
  title: "Connect this display",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
