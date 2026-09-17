import "server-only";
import nodemailer from "nodemailer";

// Generic SMTP, not a provider-specific SDK — this app's own custom
// "here's your temp password" email can't go through Supabase Auth's
// mailer (its templates only support the fixed flows it defines: confirm
// signup, invite-by-link, recovery, email change — none of them let you
// hand a caller arbitrary body text). Whatever SMTP credentials are
// already configured for Supabase Auth's Custom SMTP (a Gmail app
// password, Resend's SMTP endpoint, anything) work here too — same
// account, two independent senders.
export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "send_failed" };

function transport(): ReturnType<typeof nodemailer.createTransport> | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
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
// recipient already has a real password. Covers both a first-time invite
// to someone who already had a Kramflow account from something else, and a
// revoke-then-reinvite of someone who'd already accepted before (that
// resets nothing about their login, just their access to this event again)
// — either way, "you have access, here's a link" is the whole message.
function addedText(params: { eventName: string; role: string; inviterName: string; loginUrl: string }): string {
  const { eventName, role, inviterName, loginUrl } = params;
  return [
    `${inviterName} added you to ${eventName} on Kramflow as a${role === "editor" ? "n" : ""} ${role}.`,
    "",
    `Log in here: ${loginUrl}`,
  ].join("\n");
}

function addedHtml(params: { eventName: string; role: string; inviterName: string; loginUrl: string }): string {
  const { eventName, role, inviterName, loginUrl } = params;
  const roleLabel = role === "editor" ? "an Editor" : "a Viewer";
  const escapedEvent = escapeHtml(eventName);
  const escapedInviter = escapeHtml(inviterName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You've been added to ${escapedEvent}</title>
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
                  You&rsquo;ve been added to ${escapedEvent}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">
                  ${escapedInviter} added you as ${roleLabel} on <strong>${escapedEvent}</strong>&rsquo;s Kramflow
                  run-of-show. Log in with your existing account to access it.
                </p>
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

export async function sendCollaboratorAddedEmail(params: {
  to: string;
  eventName: string;
  role: "editor" | "viewer";
  inviterName: string;
  loginUrl: string;
}): Promise<SendResult> {
  const mailer = transport();
  const from = process.env.SMTP_FROM_EMAIL;
  if (!mailer || !from) return { sent: false, reason: "not_configured" };

  try {
    await mailer.sendMail({
      from,
      to: params.to,
      subject: `${params.inviterName} added you to ${params.eventName} on Kramflow`,
      html: addedHtml(params),
      text: addedText(params),
    });
    return { sent: true };
  } catch (error) {
    console.error("sendCollaboratorAddedEmail failed:", error);
    return { sent: false, reason: "send_failed" };
  }
}

export async function sendCollaboratorTempPasswordEmail(params: {
  to: string;
  eventName: string;
  role: "editor" | "viewer";
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<SendResult> {
  const mailer = transport();
  const from = process.env.SMTP_FROM_EMAIL;
  if (!mailer || !from) return { sent: false, reason: "not_configured" };

  const emailParams = { ...params, email: params.to };
  try {
    await mailer.sendMail({
      from,
      to: params.to,
      subject: `${params.inviterName} invited you to ${params.eventName} on Kramflow`,
      html: inviteHtml(emailParams),
      text: inviteText(emailParams),
    });
    return { sent: true };
  } catch (error) {
    console.error("sendCollaboratorTempPasswordEmail failed:", error);
    return { sent: false, reason: "send_failed" };
  }
}
