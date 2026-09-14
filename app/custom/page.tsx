import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import CustomDisplayClient from "./custom-display-client";

// Same server-component access gate as the 4 fixed display pages
// (general/av/green-room/presenter) — see general/page.tsx's comment for
// why token vs. eventId is threaded through the way it is. The one real
// difference: a custom display also needs to know *which* DisplayProfile
// to render, since unlike the 4 fixed types there's no single page per
// type — profileId picks the specific profile among however many this
// event has defined.
export default async function CustomDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; eventId?: string; profileId?: string }>;
}) {
  const { token, eventId, profileId } = await searchParams;
  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return <LinkInvalid reason={access.reason} />;
  return token ? (
    <CustomDisplayClient token={token} profileId={profileId} />
  ) : (
    <CustomDisplayClient eventId={access.eventId} profileId={profileId} />
  );
}
