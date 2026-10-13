import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

export const metadata: Metadata = {
  title: "Set Password",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
