import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";
import { EMAIL_LOGO_BASE64 } from "./email-logo";

const LOGO_CID = "caa-logo@legal";

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
 * Shared shell for every email: a blue page with a white logo badge on top and a white card
 * below (matches the login screen). Table-based with inline styles because mail clients ignore
 * <style> blocks. The logo is attached and referenced by CID, so it displays without any
 * dependency on APP_URL or an external image host.
 */
function layout(title: string, bodyHtml: string, preheader = "") {
  const year = new Date().getFullYear();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
  <body style="margin:0;padding:0;background:#4169E1;font-family:Inter,'Segoe UI',Arial,Helvetica,sans-serif;color:#1F2328;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#4169E1;">
      <tr><td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
          <tr><td align="center" style="padding:0 0 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="background:#FFFFFF;border-radius:18px;padding:14px 22px;">
              <img src="cid:${LOGO_CID}" alt="Uganda Civil Aviation Authority" width="126" height="60" style="display:block;width:126px;height:60px;border:0;outline:none;">
            </td></tr></table>
            <p style="margin:14px 0 0;font-size:18px;line-height:1.3;font-weight:700;color:#FFFFFF;letter-spacing:.01em;">CAA Legal Department</p>
            <p style="margin:2px 0 0;font-size:12px;color:#DCE4FB;letter-spacing:.04em;">Case &amp; Matter Management</p>
          </td></tr>
          <tr><td style="background:#FFFFFF;border-radius:16px;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:30px 32px 32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#1F2328;">${title}</h1>
                <div style="font-size:14px;line-height:1.65;color:#1F2328;">${bodyHtml}</div>
              </td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.6;color:#DCE4FB;">
            Uganda Civil Aviation Authority &mdash; Legal Department<br>This is an automated message; please do not reply.<br>&copy; ${year} CAA Legal
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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#E8EDFC;border:1px solid #CBD6F7;border-radius:12px;">
      <tr><td style="padding:14px 16px;font-size:13px;color:#4A5675;">Email<br><strong style="font-size:14px;color:#1F2328;">${esc(email)}</strong></td></tr>
      <tr><td style="padding:0 16px 14px;font-size:13px;color:#4A5675;">Password<br><strong style="font-size:14px;color:#1F2328;font-family:Consolas,Menlo,monospace;">${esc(password)}</strong></td></tr>
    </table>`;
}

/** Plain-text twin of the HTML body — better deliverability and a fallback for text-only clients. */
function toText(html: string) {
  return html
    .replace(/<span style="display:none[^>]*>[\s\S]*?<\/span>/i, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/h1|\/tr|\/div)\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&mdash;/g, "—").replace(/&copy;/g, "©").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function send(to: string, subject: string, html: string) {
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    text: toText(html),
    attachments: [{ filename: "caa-logo.png", content: Buffer.from(EMAIL_LOGO_BASE64, "base64"), cid: LOGO_CID, contentType: "image/png", contentDisposition: "inline" }],
  });
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

/** Two-factor sign-in code — email-OTP, not an authenticator app (spec revision: simpler for staff). */
export async function sendTwoFactorCodeEmail(to: string, name: string, code: string) {
  await send(
    to,
    `${code} is your CAA Legal sign-in code`,
    layout(
      `Hello ${esc(name)}`,
      `<p style="margin:0 0 16px;">Enter this code to finish signing in to CAA Legal:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#E8EDFC;border:1px solid #CBD6F7;border-radius:12px;">
        <tr><td style="padding:16px 24px;font-size:28px;font-weight:700;letter-spacing:.3em;color:#1F2328;font-family:Consolas,Menlo,monospace;">${esc(code)}</td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6B6760;">This code expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</p>`,
      `${code} is your sign-in code.`,
    ),
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
