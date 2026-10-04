import type { Metadata } from "next";

// Invite links carry a token in the path. The head stays static and noindex,
// so the token never appears in a title, description, or preview.
export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
