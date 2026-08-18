import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import GreenRoomDisplayClient from "./green-room-display-client";

export default async function GreenRoomDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; eventId?: string }>;
}) {
  const { token, eventId } = await searchParams;
  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return <LinkInvalid reason={access.reason} />;
  return token ? <GreenRoomDisplayClient token={token} /> : <GreenRoomDisplayClient eventId={access.eventId} />;
}
