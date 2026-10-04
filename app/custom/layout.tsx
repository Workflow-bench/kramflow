import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Display",
  robots: { index: false, follow: false },
};

export default function CustomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
