// A redirect target taken from a query string (`?next=`) is attacker-controllable
// on a public URL. Only a same-origin path is safe to navigate to.
//
// Browsers strip ASCII tab and newline characters from a URL before parsing it,
// and treat a backslash like a slash. So "/\t/evil.com" is protocol-relative
// (it becomes "//evil.com") even though it does not start with "//". The check
// therefore rejects control characters and backslashes anywhere in the value,
// then confirms the value resolves to the same origin.
const SENTINEL_ORIGIN = "https://kramflow.invalid";

export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // Control characters (including tab and newline) and backslashes, anywhere.
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return false;
  try {
    return new URL(path, SENTINEL_ORIGIN).origin === SENTINEL_ORIGIN;
  } catch {
    return false;
  }
}

export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  return raw && isSafeRedirect(raw) ? raw : fallback;
}
