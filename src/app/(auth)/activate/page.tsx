import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PASSWORD_LINK_PREFIX } from "@/lib/password-links";
import { ActivateForm } from "./activate-form";

export const metadata = { title: "Choose your password" };

/** The one page behind both the invite link and the "forgot password" link (spec §15). */
export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  // Look the link up only to pick the wording; activateAction re-checks it before using it.
  const link = token && !error ? await db.verification.findFirst({ where: { identifier: `${PASSWORD_LINK_PREFIX}${token}` } }) : null;
  const person =
    link && link.expiresAt > new Date()
      ? await db.user.findUnique({
          where: { id: link.value },
          select: { name: true, isActive: true, deletedAt: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
        })
      : null;

  if (!token || !person || !person.isActive || person.deletedAt) {
    return (
      <>
        <h1 className="m-0 mb-4 text-lg font-semibold">This link is no longer valid</h1>
        <FormAlert>Invitation and reset links expire after 72 hours, work only once, and stop working when a newer one is sent.</FormAlert>
        <p className="m-0 mt-4 text-[13px] text-text-muted">
          Request a new link below, or ask the Head of Legal to resend your invitation.
        </p>
        <Link href="/forgot-password" className={`${buttonVariants({ variant: "primary" })} mt-5 w-full justify-center`}>
          Request a new link
        </Link>
      </>
    );
  }

  const firstTime = person.accounts.length === 0;
  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">{firstTime ? `Welcome, ${person.name}` : "Choose a new password"}</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">
        {firstTime
          ? `Choose a password for your CAA Legal account.${env.REQUIRE_2FA ? " Next, you'll turn on the emailed sign-in code that protects it." : ""}`
          : "Choose a new password for your CAA Legal account. You'll be signed out of every other device."}
      </p>
      <ActivateForm token={token} submitLabel={firstTime ? "Set password and continue" : "Save new password"} />
    </>
  );
}
