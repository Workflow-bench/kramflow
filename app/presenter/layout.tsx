import type { Metadata } from "next";
import { PRIVATE_OPEN_GRAPH } from "@/lib/private-metadata";

export const metadata: Metadata = {
  title: "Presenter Display",
  robots: { index: false, follow: false },
  openGraph: PRIVATE_OPEN_GRAPH,
};

export default function PresenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
