import { notFound } from "next/navigation";

// SYNTHETIC HARNESS, development only (404 in production, same gate as the other
// catalog harnesses). Mounts the real Modal and ConfirmDialog as DOM siblings, the
// layout used by components/dashboard/share-link-panel.tsx.

// Production build: the harness module is not imported (see the dev branch), so no
// chunk is emitted and the route returns 404 (KF-025 pattern).
export default async function ModalHarnessPage() {
  if (process.env.NODE_ENV !== "production") {
    const { ModalStackHarness } = await import("./harness");
    return <ModalStackHarness />;
  }
  notFound();
}
