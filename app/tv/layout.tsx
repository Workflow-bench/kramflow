import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect this display",
  robots: { index: false, follow: false },
};

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
