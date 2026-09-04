import { resolveInvite } from "@/lib/server/collaborator-invites";
import { InviteInvalid } from "@/components/auth/invite-invalid";
import { AcceptInvitePanel } from "@/components/auth/accept-invite-panel";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// The landing page every collaborator invite email links to. Deliberately
// read-only here — acceptance itself (the actual DB write) happens client
// side via AutoAccept's POST to /api/invites/[token]/accept, not during this
// Server Component's render, so a prefetch or duplicate render of this page
// can never silently consume the invite.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveInvite(token);

  if (!resolved.ok) {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background px-6">
        <InviteInvalid reason={resolved.reason} />
      </main>
    );
  }

  const { invite, event } = resolved;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let panel: React.ReactNode;
  if (user) {
    panel =
      user.email?.toLowerCase() === invite.invited_email.toLowerCase() ? (
        <AcceptInvitePanel mode="auto-accept" token={token} eventName={event.name} />
      ) : (
        <AcceptInvitePanel mode="mismatch" invitedEmail={invite.invited_email} loggedInEmail={user.email ?? ""} />
      );
  } else {
    const admin = supabaseAdmin();
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const hasAccount = Boolean(
      usersPage?.users.some((u) => u.email?.toLowerCase() === invite.invited_email.toLowerCase())
    );
    const emailParam = encodeURIComponent(invite.invited_email);
    const nextParam = encodeURIComponent(`/invite/${token}`);
    panel = (
      <AcceptInvitePanel
        mode="signed-out"
        eventName={event.name}
        role={invite.role}
        hasAccount={hasAccount}
        loginHref={`/login?next=${nextParam}&email=${emailParam}`}
        signupHref={`/signup?invite=${token}&email=${emailParam}`}
      />
    );
  }

  return <main className="h-screen w-screen flex items-center justify-center bg-background px-6">{panel}</main>;
}
