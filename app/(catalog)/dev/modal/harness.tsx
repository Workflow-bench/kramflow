"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

// SYNTHETIC. Lower = Modal ("Manage links"), upper = ConfirmDialog ("Revoke link"),
// DOM siblings, as in the share-link panel. A background button sits outside both.
export function ModalStackHarness() {
  const [lowerOpen, setLowerOpen] = useState(false);
  const [lowerMounted, setLowerMounted] = useState(true);
  const [upperOpen, setUpperOpen] = useState(false);
  const [bgClicks, setBgClicks] = useState(0);
  const [revoked, setRevoked] = useState(0);
  const openTrigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="p-6 flex flex-col gap-4">
      <p data-harness-banner className="text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic harness, development only. Modal and ConfirmDialog stack.
      </p>
      <Button variant="secondary" ref={openTrigger} onClick={() => { setLowerMounted(true); setLowerOpen(true); }}>Manage links</Button>
      <Button variant="ghost" data-unmount onClick={() => { setLowerMounted(false); setLowerOpen(false); }}>Unmount Manage links</Button>
      <Button variant="ghost" onClick={() => setBgClicks((n) => n + 1)}>Background action</Button>
      <p data-bg-clicks className="text-console-meta text-muted">{`background clicks: ${bgClicks}`}</p>
      <p data-revoked className="text-console-meta text-muted">{`revoked: ${revoked}`}</p>
      {lowerMounted && <Modal open={lowerOpen} onClose={() => setLowerOpen(false)} title="Manage links" size="md">
        <div className="flex flex-col gap-3">
          <p className="text-console-sm text-muted">SYNTHETIC link list</p>
          <Button variant="danger" onClick={() => setUpperOpen(true)}>Revoke link</Button>
          <Button variant="ghost" onClick={() => setLowerOpen(false)}>Done</Button>
        </div>
      </Modal>}
      <ConfirmDialog
        open={upperOpen}
        title="Revoke link?"
        description="SYNTHETIC: this link stops working."
        confirmLabel="Revoke"
        tone="danger"
        onConfirm={() => {
          setRevoked((n) => n + 1);
          setUpperOpen(false);
        }}
        onCancel={() => setUpperOpen(false)}
      />
    </div>
  );
}
