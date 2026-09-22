// A redirect target taken from a query string (`?next=`) is attacker-controllable
// on a public URL. Only a same-origin path is safe to navigate to: it must start
// with a single "/" and not "//" or "/\", both of which browsers treat as
// protocol-relative and will happily send off-site.
export function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  return raw && isSafeRedirect(raw) ? raw : fallback;
}
