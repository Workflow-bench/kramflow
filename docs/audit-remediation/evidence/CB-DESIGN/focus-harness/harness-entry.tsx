// Controlled dialog-cleanup harness. Renders the REAL Modal and ConfirmDialog from source.
// Controlled local fixture: no KramFlow auth, API or database operation.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { __inertMarkCount } from "@/components/ui/use-dialog-focus";

type Trig = "visible" | "hidden" | "disabled" | "gone";

function App() {
  const [lower, setLower] = useState(false);
  const [upper, setUpper] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [trig, setTrig] = useState<Trig>("visible");
  (window as any).H = {
    setLower,
    setUpper,
    setConfirm,
    setTrig,
    inert: () => __inertMarkCount(),
    lower,
    upper,
  };
  return (
    <>
      <main id="main-content" tabIndex={-1}>
        <h1>Harness</h1>
        {trig !== "gone" && (
          <button
            id="trigger"
            style={{ visibility: trig === "hidden" ? "hidden" : "visible" }}
            disabled={trig === "disabled"}
            onClick={() => setLower(true)}
          >
            Open
          </button>
        )}
        <button id="page-control" onClick={() => {}}>Page control</button>
      </main>
      <Modal open={lower} onClose={() => setLower(false)} title="Lower">
        <button id="lower-a" onClick={() => setUpper(true)}>Lower A</button>
        <button id="lower-b">Lower B</button>
      </Modal>
      <Modal open={upper} onClose={() => setUpper(false)} title="Upper">
        <button id="upper-a" onClick={() => setConfirm(true)}>Upper A</button>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Confirm"
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
