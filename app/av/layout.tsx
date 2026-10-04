import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AV Display",
  robots: { index: false, follow: false },
};

export default function AvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
