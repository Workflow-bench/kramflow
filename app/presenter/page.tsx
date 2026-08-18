import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import PresenterDisplayClient from "./presenter-display-client";

export default async function PresenterDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; eventId?: string }>;
}) {
  const { token, eventId } = await searchParams;
  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return <LinkInvalid reason={access.reason} />;
  return token ? <PresenterDisplayClient token={token} /> : <PresenterDisplayClient eventId={access.eventId} />;
}
