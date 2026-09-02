// Shared (client + server) fallback chain for "what do we call this
// person": their chosen display name, then their email, then a generic
// label — never fabricated, never blank. No "server-only" import here on
// purpose — lib/use-operator-presence.ts needs this client-side to label
// a presence entry with the signed-in operator's own name; the
// admin-API-backed lookup (lib/server/user-display-name.ts) wraps this for
// resolving *other* users' names server-side.
export function resolveDisplayName(user: { user_metadata?: unknown; email?: string | null } | null): string {
  const name = (user?.user_metadata as { name?: string } | undefined)?.name;
  return name || user?.email || "A Kramflow operator";
}
