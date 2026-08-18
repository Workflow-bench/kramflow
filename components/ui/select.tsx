"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

// A single accessible combobox — no Select/Combobox primitive existed in
// components/ui/. Follows the Console token set: 6px radius, accent focus,
// 140ms transitions.
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = true,
  size = "md",
  className,
  ...aria
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  useEffect(() => {
    if (!open) return;
    // Query/highlight reset happens in handleToggle, not here — setting
    // state synchronously inside an effect triggers a cascading re-render.
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setQuery("");
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function commit(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-control bg-raised border border-line text-primary cursor-pointer",
          "transition-[background-color,border-color] duration-[110ms] ease-out",
          "hover:bg-card-hover hover:border-white/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open && "border-accent",
          size === "md" && "h-9 px-3 text-console-sm",
          size === "lg" && "h-11 px-3.5 text-console-md"
        )}
      >
        <span className={cn("truncate text-left", !selected && "text-muted-2 font-normal")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1.5 w-full min-w-[15rem] max-h-80 flex flex-col overflow-hidden rounded-panel bg-card border border-line shadow-float motion-safe:animate-rise"
        >
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line-soft shrink-0">
              <Search className="h-3.5 w-3.5 text-muted-2 shrink-0" strokeWidth={2} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlighted((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && filtered[highlighted]) {
                    e.preventDefault();
                    commit(filtered[highlighted].value);
                  }
                }}
                placeholder="Search…"
                aria-label="Filter options"
                className="w-full bg-transparent text-console-sm text-primary placeholder:text-muted-2 outline-none"
              />
            </div>
          )}
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-console-meta text-muted-2">No matches</p>
            )}
            {filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => commit(opt.value)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer",
                  "transition-colors duration-[110ms] ease-out",
                  i === highlighted ? "bg-card-hover" : "hover:bg-card-hover"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-console-sm text-primary truncate">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-console-meta text-muted-2 truncate">{opt.description}</span>
                  )}
                </span>
                {opt.value === value && <Check className="h-4 w-4 text-accent shrink-0" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
