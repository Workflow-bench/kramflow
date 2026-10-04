import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Green Room Display",
  robots: { index: false, follow: false },
};

export default function GreenRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
