import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

export const metadata: Metadata = {
  title: "AV Display",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function AvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
