"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;
// Longer window when there's an action (e.g. "Undo") to actually click —
// 3.5s is enough to read a message, not enough to read it, decide, and act.
const AUTO_DISMISS_WITH_ACTION_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((tone: ToastTone, message: string, action?: ToastAction) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, tone, message, action }]);
    setTimeout(
      () => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      },
      action ? AUTO_DISMISS_WITH_ACTION_MS : AUTO_DISMISS_MS
    );
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (message: string, action?: ToastAction) => push("success", message, action),
    error: (message: string, action?: ToastAction) => push("error", message, action),
    info: (message: string, action?: ToastAction) => push("info", message, action),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 rounded-panel bg-card px-4 py-3 text-console-sm shadow-lg border",
                item.tone === "success" && "border-status-green/20",
                item.tone === "error" && "border-status-red/20",
                item.tone === "info" && "border-status-blue/20"
              )}
            >
              {item.tone === "success" && <CheckCircle2 className="h-4 w-4 text-status-green shrink-0" strokeWidth={2} />}
              {item.tone === "error" && <XCircle className="h-4 w-4 text-status-red shrink-0" strokeWidth={2} />}
              {item.tone === "info" && <Info className="h-4 w-4 text-status-blue shrink-0" strokeWidth={2} />}
              <span className="text-primary">{item.message}</span>
              {item.action && (
                // Button-weight, not a text link — this is the deliberate
                // choice for single-item delete's Undo (docs/DESIGN.md's
                // guardrail-tier table): a confirm dialog no longer
                // precedes that action, so this toast's action is the
                // *entire* guardrail and has to read as one, not as
                // incidental toast chrome.
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                  className="ml-1 shrink-0 focus-visible:ring-offset-card"
                >
                  {item.action.label}
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
