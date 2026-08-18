import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import AvDisplayClient from "./av-display-client";

export default async function AvDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; eventId?: string }>;
}) {
  const { token, eventId } = await searchParams;
  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return <LinkInvalid reason={access.reason} />;
  return token ? <AvDisplayClient token={token} /> : <AvDisplayClient eventId={access.eventId} />;
}
