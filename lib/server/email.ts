import "server-only";
import { Resend } from "resend";

// Resend's Node SDK, not raw SMTP — this app's own custom "here's your temp
// password" email can't go through Supabase Auth's mailer (its templates
// only support the fixed flows it defines: confirm signup, invite-by-link,
// recovery, email change — none of them let you hand a caller arbitrary
// body text), so it goes through the same provider as a second, independent
// sender instead.
export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "send_failed" };

function client(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function inviteText(params: {
  eventName: string;
  role: string;
  inviterName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  const { eventName, role, inviterName, email, tempPassword, loginUrl } = params;
  return [
    `${inviterName} invited you to ${eventName} on Kramflow as a${role === "editor" ? "n" : ""} ${role}.`,
    "",
    "Log in with:",
    `Email: ${email}`,
    `Temporary password: ${tempPassword}`,
    "",
    `Log in here: ${loginUrl}`,
    "",
    "You'll be asked to set your own password the first time you log in.",
  ].join("\n");
}

function inviteHtml(params: {
  eventName: string;
  role: string;
  inviterName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  const { eventName, role, inviterName, email, tempPassword, loginUrl } = params;
  const roleLabel = role === "editor" ? "an Editor" : "a Viewer";
  const escapedEvent = escapeHtml(eventName);
  const escapedInviter = escapeHtml(inviterName);
  const escapedEmail = escapeHtml(email);
  const escapedTempPassword = escapeHtml(tempPassword);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're invited to ${escapedEvent}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
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
                  run-of-show.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:8px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#71717a;">Email</p>
                      <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#18181b;">${escapedEmail}</p>
                      <p style="margin:0 0 4px 0;font-size:12px;color:#71717a;">Temporary password</p>
                      <p style="margin:0;font-size:16px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;color:#18181b;">${escapedTempPassword}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <a
                  href="${loginUrl}"
                  style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:8px;"
                >
                  Log in to Kramflow
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;border-top:1px solid #f0f0f1;">
                <p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#a1a1aa;">
                  You&rsquo;ll be asked to set your own password the first time you log in.
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

// The existing-account counterpart to inviteText/inviteHtml above — same
// card, no credential box, since there's nothing to hand over: the
// recipient already has a real password. This is still a pending invite
// requiring an explicit accept, not instant access — a revoke is a real
// removal (event-settings-panel's DELETE hard-deletes the row), so being
// invited again, even as an already-known account, goes through the same
// accept step as anyone else rather than silently re-granting access.
function inviteExistingAccountText(params: {
  eventName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
}): string {
  const { eventName, role, inviterName, acceptUrl } = params;
  return [
    `${inviterName} invited you to ${eventName} on Kramflow as a${role === "editor" ? "n" : ""} ${role}.`,
    "",
    `Accept the invitation here: ${acceptUrl}`,
    "",
    "Log in with your existing Kramflow account to accept.",
  ].join("\n");
}

function inviteExistingAccountHtml(params: {
  eventName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
}): string {
  const { eventName, role, inviterName, acceptUrl } = params;
  const roleLabel = role === "editor" ? "an Editor" : "a Viewer";
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
                  ${escapedInviter} invited you as ${roleLabel} on <strong>${escapedEvent}</strong>&rsquo;s Kramflow
                  run-of-show. Log in with your existing account to accept.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <a
                  href="${acceptUrl}"
                  style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:8px;"
                >
                  Accept invitation
                </a>
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

export async function sendCollaboratorInviteToExistingAccountEmail(params: {
  to: string;
  eventName: string;
  role: "editor" | "viewer";
  inviterName: string;
  acceptUrl: string;
}): Promise<SendResult> {
  const resend = client();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return { sent: false, reason: "not_configured" };

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.eventName} on Kramflow`,
    html: inviteExistingAccountHtml(params),
    text: inviteExistingAccountText(params),
  });
  if (error) {
    console.error("sendCollaboratorInviteToExistingAccountEmail failed:", error.message);
    return { sent: false, reason: "send_failed" };
  }
  return { sent: true };
}

export async function sendCollaboratorTempPasswordEmail(params: {
  to: string;
  eventName: string;
  role: "editor" | "viewer";
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<SendResult> {
  const resend = client();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return { sent: false, reason: "not_configured" };

  const emailParams = { ...params, email: params.to };
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.eventName} on Kramflow`,
    html: inviteHtml(emailParams),
    text: inviteText(emailParams),
  });
  if (error) {
    console.error("sendCollaboratorTempPasswordEmail failed:", error.message);
    return { sent: false, reason: "send_failed" };
  }
  return { sent: true };
}
