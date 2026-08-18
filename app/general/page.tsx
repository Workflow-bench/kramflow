import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import GeneralDisplayClient from "./general-display-client";

// Server Component gate — verifies (session+eventId OR valid share-link
// token) before the client display ever mounts or reads any live data.
//
// Which prop the client polls with matters: a token-reached visitor keeps
// polling with that *same token* on every request (not the resolved
// eventId) so a revoke takes effect within one poll interval on an
// already-open display, not just on next navigation — and so an
// anonymous visitor's later polls don't depend on a session they don't
// have. A session-reached (operator preview) visitor polls with eventId,
// relying on their cookies being sent automatically.
export default async function GeneralDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; eventId?: string }>;
}) {
  const { token, eventId } = await searchParams;
  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return <LinkInvalid reason={access.reason} />;
  return token ? <GeneralDisplayClient token={token} /> : <GeneralDisplayClient eventId={access.eventId} />;
}
