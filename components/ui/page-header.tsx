// Canonical page header for non-Console authenticated surfaces (Dashboard/
// Event Home first; future routes reuse it rather than each hand-rolling
// eyebrow+title+meta+actions again). The Operator Console keeps its own
// header (EventIdentity + session strip + nav are structurally different —
// a workspace toolbar, not a document header), so this is deliberately
// scoped to "document-shaped" pages, not a universal AppHeader.
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {eyebrow && <p className="text-console-label text-muted-2 uppercase tracking-wide">{eyebrow}</p>}
        <h1 className="text-console-lg text-primary mt-1">{title}</h1>
        {meta && <div className="text-console-sm text-muted mt-1">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
