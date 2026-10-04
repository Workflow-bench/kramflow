import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Password",
  robots: { index: false, follow: false },
};

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
