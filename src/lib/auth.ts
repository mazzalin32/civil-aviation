import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { env } from "./env";
import { sendPasswordChangedEmail, sendResetPasswordEmail } from "./mailer";

/**
 * Better Auth server instance (CLAUDE.md: Auth · TOTP 2FA · Admin-created accounts only).
 *
 * - No public sign-up. Admin creates the `User` row directly (Phase 3); the person
 *   only ever reaches Better Auth through the same reset-password link, whether it's
 *   their first-time invite or a later "forgot password" (spec §15 decision).
 * - `twoFactor` adds its own table + the `twoFactorEnabled` flag on User.
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
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60 * 72, // 72h covers both the invite link and forgot-password
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, user.name, url);
    },
    onPasswordReset: async ({ user }) => {
      await sendPasswordChangedEmail(user.email, user.name);
    },
  },
  session: {
    expiresIn: 15 * 60,
    updateAge: 0, // refresh on every request → expiry tracks last activity, not first login
  },
  plugins: [
    twoFactor({ issuer: "CAA Legal" }),
    haveIBeenPwned({
      customPasswordCompromisedMessage: "This password has appeared in a public data breach. Choose a different one.",
    }),
    nextCookies(), // must be last: sets Set-Cookie from within Server Actions
  ],
});
