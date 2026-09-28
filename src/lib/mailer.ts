import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * SMTP sender. Dev points at Mailpit (http://localhost:8025); production points at
 * UCAA's real SMTP server via the same env vars — the app never assumes a provider.
 */
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#F7F6F3;font-family:Arial,Helvetica,sans-serif;color:#1F2328;padding:32px 16px;">
    <table role="presentation" style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E3DD;border-radius:16px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#4169E1;">CAA LEGAL</p>
        <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
        ${bodyHtml}
        <p style="margin:32px 0 0;font-size:12px;color:#6B6760;">Uganda Civil Aviation Authority — Legal Department. This is an automated message; please do not reply.</p>
      </td></tr>
    </table>
  </body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#4169E1;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:500;">${label}</a></p>
    <p style="margin:0 0 20px;font-size:12px;color:#6B6760;word-break:break-all;">Or paste this link into your browser: ${href}</p>`;
}

async function send(to: string, subject: string, html: string) {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, html });
}

/** Both the first-time invite and every later "forgot password" send this same email (spec §15). */
export async function sendResetPasswordEmail(to: string, name: string, url: string) {
  await send(
    to,
    "Set your CAA Legal password",
    layout(
      `Hello ${name},`,
      `<p style="margin:0 0 8px;">Use the button below to set your password. This link is valid for 72 hours and can only be used once.</p>${button(url, "Set your password")}<p style="margin:0;font-size:13px;color:#6B6760;">If you didn't expect this email, you can ignore it — no changes were made to your account.</p>`,
    ),
  );
}

export async function sendPasswordChangedEmail(to: string, name: string) {
  await send(
    to,
    "Your CAA Legal password was changed",
    layout(
      `Hello ${name},`,
      `<p style="margin:0;">Your password was just changed. If this wasn't you, contact the Head of Legal immediately.</p>`,
    ),
  );
}

/** Every notification email shares this shape — subject/message/url are built per trigger by src/lib/notify.ts callers. */
export async function sendNotificationEmail(to: string, name: string, subject: string, message: string, url?: string) {
  await send(
    to,
    subject,
    layout(subject, `<p style="margin:0 0 8px;">Hello ${name},</p><p style="margin:0 0 8px;">${message}</p>${url ? button(url, "Open") : ""}`),
  );
}

export async function sendAccountLockedEmail(to: string, lockedUserName: string, lockedUserEmail: string) {
  await send(
    to,
    `Account locked: ${lockedUserName}`,
    layout(
      "Account locked after repeated failed logins",
      `<p style="margin:0;">${lockedUserName} (${lockedUserEmail}) was locked out for 15 minutes after 5 failed sign-in attempts.</p>`,
    ),
  );
}
