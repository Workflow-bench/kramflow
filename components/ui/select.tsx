"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismissOnOutsideOrEscape } from "@/lib/use-dismiss-on-outside-or-escape";
import { useFormField } from "./form-field";

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary line under the label — e.g. a session's day, an auditorium's location. */
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Shows a filter input above the option list. On by default — this
   *  replaces both the plain-select and long-list cases. */
  searchable?: boolean;
  /** Larger trigger for the primary session switcher, which is navigation
   *  rather than a form field and should read as such. */
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
  /** Pass -1 to pull the trigger out of Tab order — e.g. a control bar
   *  that's faded to opacity-0 but stays pointer-reachable (see
   *  app/presenter/presenter-display-client.tsx) still shouldn't be
   *  keyboard-focusable while invisible. */
  tabIndex?: number;
  disabled?: boolean;
}

// One complete WAI-ARIA APG pattern (F11, 2026-10 review): a button opens a
// popup listbox. When searchable, the filter input is the combobox
// (aria-controls + aria-activedescendant pointing at the highlighted
// option); otherwise the listbox itself takes focus with the same active-
// descendant model. Arrow keys, Home/End, Enter, Escape and Tab behave per
// the pattern, and focus always returns to the trigger after a choice or
// Escape. The previous version mixed a listbox role with button options and
// never connected the visual highlight to assistive technology.
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = true,
  size = "md",
  className,
  tabIndex,
  disabled = false,
  ...aria
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const label = aria["aria-label"];
  // R2: inside a FormField the trigger takes the field's id (so its
  // <label htmlFor> names it) and its error description.
  const field = useFormField();

  const selected = options.find((o) => o.value === value);
  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options;
  const activeId = open && filtered[highlighted] ? optionId(highlighted) : undefined;

  useEffect(() => {
    if (!open) return;
    // setTimeout, not rAF: rAF can stall in a backgrounded or throttled tab,
    // which would leave focus on the trigger with the popup open.
    const id = setTimeout(() => (searchable ? searchRef.current : listRef.current)?.focus(), 0);
    return () => clearTimeout(id);
  }, [open, searchable]);

  useEffect(() => {
    if (!open || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  // Outside click closes without moving focus; Escape returns focus to the
  // trigger.
  useDismissOnOutsideOrEscape(rootRef, open, (reason) => close(reason === "escape"));

  function openList() {
    if (disabled) return;
    setQuery("");
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function commit(v: string) {
    onChange(v);
    close(true);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    const last = filtered.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, last));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (!searchable && e.key === "Home") {
      // In the searchable filter, Home/End move the text caret (APG).
      e.preventDefault();
      setHighlighted(0);
    } else if (!searchable && e.key === "End") {
      e.preventDefault();
      setHighlighted(Math.max(0, last));
    } else if (e.key === "Enter" || (!searchable && e.key === " ")) {
      // Always swallow Enter: this control often sits inside a <form>, and
      // an Enter with no match must not submit it.
      e.preventDefault();
      e.stopPropagation();
      if (filtered[highlighted]) commit(filtered[highlighted].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* ARIA 1.2 doesn't list aria-invalid for a plain button, but browsers
          still expose it. Switching the trigger to role="combobox" would
          change its keyboard contract, which is out of scope here. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        ref={triggerRef}
        id={field?.id}
        aria-describedby={field?.errorId}
        // FormField's invalid state, alongside its error description above
        // (see the lint note on <button>).
        aria-invalid={field?.invalid || undefined}
        type="button"
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openList();
          }
        }}
        tabIndex={tabIndex}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label ? `${label}: ${selected?.label ?? placeholder}` : undefined}
        // Inside a FormField the trigger is named by the field label plus
        // its own text, so the current value is still announced.
        aria-labelledby={!label && field ? `${field.labelId} ${baseId}-value` : undefined}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-control bg-raised border border-line-field text-primary cursor-pointer",
          "transition-[background-color,border-color] duration-[110ms] ease-out",
          "hover:bg-card-hover hover:border-white/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-raised disabled:hover:border-line",
          open && "border-accent",
          size === "md" && "h-9 px-3 text-console-sm",
          size === "lg" && "h-11 px-3.5 text-console-md"
        )}
      >
        <span id={`${baseId}-value`} className={cn("truncate text-left", !selected && "text-muted-2 font-normal")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        // Solid surface (AD03): a popup over operational content stays fully
        // legible regardless of what passes behind it.
        <div className="absolute z-30 mt-1.5 w-full min-w-[15rem] max-h-80 flex flex-col overflow-hidden rounded-panel bg-card border border-line shadow-float motion-safe:animate-rise">
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line-soft shrink-0">
              <Search className="h-3.5 w-3.5 text-muted-2 shrink-0" strokeWidth={2} aria-hidden="true" />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded={true}
                aria-controls={listboxId}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label={label ? `Filter ${label.toLowerCase()} options` : "Filter options"}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={onListKeyDown}
                placeholder="Search…"
                // text-base below sm: — same iOS zoom-on-focus fix as Input.
                className="w-full bg-transparent text-base sm:text-console-sm text-primary placeholder:text-muted-2 outline-none"
              />
            </div>
          )}
          {filtered.length === 0 && (
            <p role="status" className="px-3 py-3 text-console-meta text-muted-2">
              No matches
            </p>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label ?? "Options"}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={searchable ? undefined : activeId}
            onKeyDown={searchable ? undefined : onListKeyDown}
            className="overflow-y-auto py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={optionId(i)}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => commit(opt.value)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer",
                  "transition-colors duration-[110ms] ease-out",
                  i === highlighted ? "bg-card-hover outline outline-1 -outline-offset-1 outline-accent/60" : "hover:bg-card-hover"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-console-sm text-primary truncate">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-console-meta text-muted-2 truncate">{opt.description}</span>
                  )}
                </span>
                {opt.value === value && <Check className="h-4 w-4 text-accent shrink-0" strokeWidth={2.5} aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
