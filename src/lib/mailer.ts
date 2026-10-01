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

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Shared shell for every email: logo header, white card, footer. Table-based with inline styles
 * because mail clients ignore <style> blocks. The logo is served from /public, so APP_URL must be
 * the real public URL in production or the image will not load.
 */
function layout(title: string, bodyHtml: string, preheader = "") {
  const logoUrl = `${env.APP_URL}/CAA-Uganda-logo-1.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
  <body style="margin:0;padding:0;background:#F7F6F3;font-family:Inter,Arial,Helvetica,sans-serif;color:#1F2328;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F3;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td style="padding:0 4px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;"><img src="${logoUrl}" alt="Uganda Civil Aviation Authority" height="44" style="display:block;height:44px;width:auto;border:0;"></td>
              <td style="vertical-align:middle;padding-left:12px;border-left:1px solid #E6E3DD;margin-left:12px;">
                <span style="display:block;font-size:11px;letter-spacing:.08em;color:#6B6760;text-transform:uppercase;">&nbsp;&nbsp;Legal Department</span>
                <span style="display:block;font-size:15px;font-weight:600;color:#1F2328;">&nbsp;&nbsp;CAA Legal</span>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="background:#FFFFFF;border:1px solid #E6E3DD;border-radius:16px;padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:#1F2328;">${title}</h1>
            <div style="font-size:14px;line-height:1.6;color:#1F2328;">${bodyHtml}</div>
          </td></tr>
          <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#6B6760;text-align:center;">
            Uganda Civil Aviation Authority &mdash; Legal Department<br>This is an automated message; please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 16px;"><tr><td style="background:#4169E1;border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
    </td></tr></table>
    <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#6B6760;word-break:break-all;">Button not working? Paste this link into your browser:<br><a href="${href}" style="color:#4169E1;">${href}</a></p>`;
}

function credentials(email: string, password: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#F7F6F3;border:1px solid #E6E3DD;border-radius:12px;">
      <tr><td style="padding:14px 16px;font-size:13px;color:#6B6760;">Email<br><strong style="font-size:14px;color:#1F2328;">${esc(email)}</strong></td></tr>
      <tr><td style="padding:0 16px 14px;font-size:13px;color:#6B6760;">Password<br><strong style="font-size:14px;color:#1F2328;font-family:Consolas,Menlo,monospace;">${esc(password)}</strong></td></tr>
    </table>`;
}

async function send(to: string, subject: string, html: string) {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, html });
}

/** Shared-password mode: lawyer can sign in immediately (no activate link). */
export async function sendLawyerReadyEmail(to: string, name: string, password: string) {
  const loginUrl = `${env.APP_URL}/login`;
  await send(
    to,
    "You've been invited to CAA Legal",
    layout(
      `Welcome, ${esc(name)}`,
      `<p style="margin:0 0 8px;">The Legal Department has created your CAA Legal account. Sign in with the details below.</p>
      ${credentials(to, password)}
      ${button(loginUrl, "Sign in to CAA Legal")}
      <p style="margin:0;font-size:13px;color:#6B6760;">For your security, change your password from your Profile page after signing in.</p>`,
      "Your CAA Legal account is ready.",
    ),
  );
}

/** Both the first-time invite and every later "forgot password" send this same email (spec §15). */
export async function sendResetPasswordEmail(to: string, name: string, url: string) {
  await send(
    to,
    "Set your CAA Legal password",
    layout(
      `Hello ${esc(name)}`,
      `<p style="margin:0 0 8px;">You've been invited to CAA Legal, the Uganda Civil Aviation Authority's legal case and matter management system. Use the button below to choose your password.</p>
      ${button(url, "Set your password")}
      <p style="margin:0 0 8px;font-size:13px;color:#6B6760;">This link is valid for 72 hours and can be used once.</p>
      <p style="margin:0;font-size:13px;color:#6B6760;">If you didn't expect this email, you can ignore it &mdash; no changes were made to your account.</p>`,
      "Choose your password to get started.",
    ),
  );
}

export async function sendPasswordChangedEmail(to: string, name: string) {
  await send(
    to,
    "Your CAA Legal password was changed",
    layout(
      `Hello ${esc(name)}`,
      `<p style="margin:0;">Your password was just changed. If this wasn't you, contact the Head of Legal immediately.</p>`,
    ),
  );
}

/** Every notification email shares this shape — subject/message/url are built per trigger by src/lib/notify.ts callers. */
export async function sendNotificationEmail(to: string, name: string, subject: string, message: string, url?: string) {
  await send(
    to,
    subject,
    layout(subject, `<p style="margin:0 0 8px;">Hello ${esc(name)},</p><p style="margin:0 0 8px;">${message}</p>${url ? button(url, "Open") : ""}`),
  );
}

export async function sendAccountLockedEmail(to: string, lockedUserName: string, lockedUserEmail: string) {
  await send(
    to,
    `Account locked: ${lockedUserName}`,
    layout(
      "Account locked after repeated failed logins",
      `<p style="margin:0;">${esc(lockedUserName)} (${esc(lockedUserEmail)}) was locked out for 15 minutes after 5 failed sign-in attempts.</p>`,
    ),
  );
}
