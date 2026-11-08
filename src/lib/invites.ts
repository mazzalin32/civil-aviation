import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { demoLoginPassword, setDemoLoginPassword } from "./demo-login";
import { sendLawyerReadyEmail } from "./mailer";

/**
 * Invitations (FLOWS §3, spec §4). An invite is Better Auth's single-use password link
 * (72 h), the same mechanism as "forgot password" — which email the person gets is decided
 * in auth.ts by whether they have a password yet, and auth.ts also cancels their older links
 * once the new one exists. Admin → Lawyer, the Excel import and Superadmin → Admin all send
 * through here.
 *
 * In the prototype's shared-password mode (DEMO_LOGIN_PASSWORD) the account gets that
 * password straight away and the email carries it instead of a link.
 */
export async function sendInvite(user: { id: string; email: string; name: string }) {
  const shared = demoLoginPassword();
  if (shared) {
    await setDemoLoginPassword(user.id);
    await sendLawyerReadyEmail(user.email, user.name, shared);
    return;
  }
  await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/activate" }, headers: await headers(), asResponse: false });
}
