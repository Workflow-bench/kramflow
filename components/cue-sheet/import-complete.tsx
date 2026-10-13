"use client";

import { Button } from "@/components/ui/button";
import type { ImportedSessionChoice } from "@/lib/cue-sheet-import-result";

// Post-import step body. Lists the sessions the import wrote and makes the live
// session an explicit choice: "Open console" is the only action that changes what
// displays show, and it is per session. Rendered inside the page's Modal.
export function ImportCompleteStep({
  choices,
  onOpen,
  onStay,
}: {
  choices: ImportedSessionChoice[];
  onOpen: (choice: ImportedSessionChoice) => void;
  onStay: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-console-sm text-muted">
        {choices.length === 0
          ? "The import wrote no sessions."
          : `The import wrote ${choices.length} session${choices.length === 1 ? "" : "s"}. Pick one to open in the console. Nothing goes live until you choose.`}
      </p>
      <ul className="flex flex-col gap-2">
        {choices.map((choice) => (
          <li key={choice.storedId} className="flex items-center justify-between gap-3 rounded-panel border border-line-soft px-3 py-2">
            <div className="min-w-0">
              <p className="text-console-sm text-primary truncate">{choice.dayLabel} • {choice.sessionLabel}</p>
              <p className="text-console-meta text-muted-2">{choice.itemCount} item{choice.itemCount === 1 ? "" : "s"}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onOpen(choice)} disabled={choice.itemCount === 0}>
              Open console
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onStay}>Stay in cue sheet</Button>
      </div>
    </div>
  );
}
