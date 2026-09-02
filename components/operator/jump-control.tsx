"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionLabel } from "@/components/ui/section-label";
import { useToast } from "@/components/ui/toast";

export function JumpControl({ max }: { max: number }) {
  const { jumpTo } = useEventStore();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [jumping, setJumping] = useState(false);
  // Ref, not just `jumping` — ConfirmDialog's own confirm button has no
  // disabled-while-submitting state, so a rapid double-click on it fires
  // onConfirm twice before either the dialog closes or `jumping` (state)
  // commits. Confirmed the identical race live on Broadcast Center's Send
  // Now button (5 clicks -> 5 live broadcasts) — a ref mutates immediately,
  // so the second click in the same burst already sees it flipped.
  const jumpingRef = useRef(false);

  const order = Number(value);
  const isValid = value.trim() !== "" && Number.isInteger(order) && order >= 1 && order <= max;

  return (
    <div>
      <SectionLabel>Jump to Item</SectionLabel>
      <div className="mt-3 flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={max}
          placeholder={`1–${max}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Item number"
          className="tabular-nums"
        />
        <Button
          variant="secondary"
          size="md"
          aria-label="Jump"
          disabled={!isValid || jumping}
          onClick={() => setConfirmOpen(true)}
        >
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Jump to item ${value}?`}
        description="This changes what's live on every connected display right now."
        confirmLabel="Jump Here"
        loading={jumping}
        onConfirm={async () => {
          if (!isValid || jumpingRef.current) return;
          jumpingRef.current = true;
          setJumping(true);
          const ok = await jumpTo(order);
          jumpingRef.current = false;
          setJumping(false);
          setConfirmOpen(false);
          if (ok) {
            setValue("");
          } else {
            toast.error("Couldn't jump to that item — try again");
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
