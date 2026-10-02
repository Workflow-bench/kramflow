import { notFound } from "next/navigation";

// The component catalog is an internal design reference. It was reachable by
// anyone on production (only marked noindex), so outside development it is
// simply not found.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
