import { notFound } from "next/navigation";
import { ModalStackHarness } from "./harness";

// SYNTHETIC HARNESS, development only (404 in production, same gate as the other
// catalog harnesses). Mounts the real Modal and ConfirmDialog as DOM siblings, the
// layout used by components/dashboard/share-link-panel.tsx.
export default function ModalHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ModalStackHarness />;
}
