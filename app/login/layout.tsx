import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Log In",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
