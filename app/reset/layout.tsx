import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

// Account recovery. Not for search.
export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
