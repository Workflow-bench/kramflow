import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a Screen",
  robots: { index: false, follow: false },
};

export default function ScreensLayout({ children }: { children: React.ReactNode }) {
  return children;
}
