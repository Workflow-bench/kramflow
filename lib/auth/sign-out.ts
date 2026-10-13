// The one client-side sign-out contract (KF-016). Returns true only when the
// server confirms the session was removed. Every logout entry point navigates
// on true and shows an honest failure on false; none of them treats an attempt
// as a success.
export async function requestSignOut(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl("/api/auth/logout", { method: "POST" });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true;
  } catch {
    return false;
  }
}
