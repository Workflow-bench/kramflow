import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

// Invite links carry a token in the path. The head stays static and noindex,
// so the token never appears in a title, description, or preview.
export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
