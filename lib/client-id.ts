// Per-tab operator identity — no real accounts in this app (see
// lib/server/auth-cookie.ts: "convenience gate for a small trusted crew,"
// not per-user auth), so a random sessionStorage-scoped id is the only
// consistent way to say "this action and that action came from the same
// tab." Shared by lib/use-operator-presence.ts (who's connected) and
// lib/store.tsx (whose control-lock claim is whose) — both need the exact
// same id for a given tab, not two independently-generated ones.

const CLIENT_ID_KEY = "kramflow-operator-client-id";

export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `op-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
