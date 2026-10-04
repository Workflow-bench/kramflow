import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Display",
  robots: { index: false, follow: false },
};

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return children;
}
