import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
  title: "Log In",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
