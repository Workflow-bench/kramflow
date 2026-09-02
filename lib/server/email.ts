import "server-only";
import { Resend } from "resend";

// Sending is optional at runtime, not a hard dependency: RESEND_API_KEY only
// exists once a verified sending domain is attached (see RESEND_FROM_EMAIL
// below — Resend refuses to deliver to third parties from an unverified
// domain, so there is no working default to fall back to). Every caller gets
// back a result instead of a thrown error so "email isn't configured yet"
// degrades to "the invite still has a copyable link" rather than a 500.
export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "send_failed" };

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

// Plain-text sibling of the HTML body below — required by every serious
// deliverability guide (mail providers weigh a missing text/plain part as a
// spam signal) and the first thing a screen reader or preview pane falls
// back to.
function inviteText(params: {
  eventName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
  hasAccount: boolean;
}): string {
  const { eventName, role, inviterName, acceptUrl, hasAccount } = params;
  return [
    `${inviterName} invited you to ${eventName} on Kramflow as a${role === "editor" ? "n" : ""} ${role}.`,
    "",
    hasAccount ? "Log in to accept:" : "Create your account to accept:",
    acceptUrl,
    "",
    "This link expires in 14 days.",
  ].join("\n");
}

// A single centered card, one accent action, no marketing chrome — the same
// shape Linear/Stripe/Vercel use for transactional mail because it's the one
// that survives every client's CSS stripping (Outlook, Gmail's clipping,
// dark-mode auto-inversion) with the content still legible. Inline styles
// only: email clients don't reliably load <style> blocks or external CSS.
function inviteHtml(params: {
  eventName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
  hasAccount: boolean;
}): string {
  const { eventName, role, inviterName, acceptUrl, hasAccount } = params;
  const roleLabel = role === "editor" ? "an Editor" : "a Viewer";
  const cta = hasAccount ? "Log in to accept" : "Create your account";
  const escapedEvent = escapeHtml(eventName);
  const escapedInviter = escapeHtml(inviterName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're invited to ${escapedEvent}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapedInviter} invited you to run ${escapedEvent} on Kramflow.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <span style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#18181b;">Kramflow</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h1 style="margin:0;font-size:20px;line-height:28px;font-weight:600;color:#18181b;">
                  You&rsquo;re invited to ${escapedEvent}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">
                  ${escapedInviter} added you as ${roleLabel} on <strong>${escapedEvent}</strong>&rsquo;s Kramflow
                  run-of-show. ${
                    role === "editor"
                      ? "You&rsquo;ll be able to edit the cue sheet."
                      : "You&rsquo;ll be able to view the live cue sheet."
                  }
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <a
                  href="${acceptUrl}"
                  style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:8px;"
                >
                  ${cta}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;border-top:1px solid #f0f0f1;">
                <p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#a1a1aa;">
                  This invite expires in 14 days. If the button above doesn&rsquo;t work, copy and paste this link:<br />
                  <a href="${acceptUrl}" style="color:#71717a;word-break:break-all;">${acceptUrl}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;">
            Sent by Kramflow on behalf of ${escapedInviter}. If you weren&rsquo;t expecting this, you can ignore it.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendCollaboratorInviteEmail(params: {
  to: string;
  eventName: string;
  role: "editor" | "viewer";
  inviterName: string;
  acceptUrl: string;
  hasAccount: boolean;
}): Promise<SendResult> {
  const resend = client();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return { sent: false, reason: "not_configured" };

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.eventName} on Kramflow`,
    html: inviteHtml(params),
    text: inviteText(params),
  });

  if (error) {
    console.error("sendCollaboratorInviteEmail failed:", error);
    return { sent: false, reason: "send_failed" };
  }
  return { sent: true };
}
