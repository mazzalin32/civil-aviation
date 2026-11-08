import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { env } from "./env";
import { demoLoginPassword } from "./demo-login";
import { sendInviteEmail, sendPasswordChangedEmail, sendResetPasswordEmail, sendTwoFactorCodeEmail } from "./mailer";
import { cancelPasswordLinks } from "./password-links";

/**
 * Better Auth server instance (CLAUDE.md: Auth · email-OTP 2FA · Admin-created accounts only).
 *
 * - No public sign-up. Admin creates the `User` row directly (Phase 3); the person
 *   only ever reaches Better Auth through the same reset-password link, whether it's
 *   their first-time invite or a later "forgot password" (spec §15 decision). The email
 *   differs: no password yet → the invite email; otherwise the reset email.
 * - `twoFactor` adds its own table + the `twoFactorEnabled` flag on User. Email-OTP only
 *   (not the authenticator-app TOTP method) — staff found scanning a QR code and running a
 *   separate app too much friction; a code emailed at login is the whole flow (2026-11-02).
 * - `haveIBeenPwned` rejects a password found in a public breach corpus (spec §9).
 * - Session `expiresIn`/`updateAge` together give the 15-minute idle timeout (spec §9);
 *   this becomes an Admin-configurable Setting in Phase 2.
 */
export const auth = betterAuth({
  appName: "CAA Legal",
  baseURL: env.APP_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: demoLoginPassword() ? Math.min(8, demoLoginPassword()!.length) : 10,
    resetPasswordTokenExpiresIn: 60 * 60 * 72, // 72h covers both the invite link and forgot-password
    revokeSessionsOnPasswordReset: true,
    // Runs for every new link: Admin invite, resend, import, Superadmin → Admin, and "forgot password".
    sendResetPassword: async ({ user, url, token }) => {
      // Only the newest link works — a resend or a fresh "forgot password" retires the earlier ones.
      await cancelPasswordLinks(user.id, token);
      const account = await db.user.findUnique({
        where: { id: user.id },
        select: { isActive: true, deletedAt: true, accounts: { where: { providerId: "credential", password: { not: null } }, select: { id: true } } },
      });
      // A deactivated or deleted account can't use the link anyway; don't send it ("forgot
      // password" still shows the same confirmation either way, so nothing is revealed).
      if (!account || !account.isActive || account.deletedAt) {
        await cancelPasswordLinks(user.id);
        return;
      }
      if (account.accounts.length === 0) await sendInviteEmail(user.email, user.name, url);
      else await sendResetPasswordEmail(user.email, user.name, url);
    },
    onPasswordReset: async ({ user }) => {
      // First activation creates the credential moments before this runs — that's someone
      // choosing their first password, not a change worth warning them about.
      const credential = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { createdAt: true } });
      if (credential && credential.createdAt.getTime() > Date.now() - 60_000) return;
      await sendPasswordChangedEmail(user.email, user.name);
    },
  },
  session: {
    expiresIn: 15 * 60,
    updateAge: 60, // extend the expiry at most once a minute (was every request = a DB write per click); idle timeout stays accurate to ±1 min
  },
  plugins: [
    twoFactor({
      issuer: "CAA Legal",
      otpOptions: {
        period: 10, // minutes — generous given email delivery isn't always instant
        async sendOTP({ user, otp }) {
          await sendTwoFactorCodeEmail(user.email, user.name, otp);
        },
      },
    }),
    // The shared prototype password is in public breach lists; skip HIBP while it's in use.
    ...(demoLoginPassword()
      ? []
      : [
          haveIBeenPwned({
            customPasswordCompromisedMessage: "This password has appeared in a public data breach. Choose a different one.",
          }),
        ]),
    nextCookies(), // must be last: sets Set-Cookie from within Server Actions
  ],
});
