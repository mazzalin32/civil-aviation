"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import { sendTwoFactorSetupOtp, confirmTwoFactorSetup } from "./actions";
import { withToast } from "@/components/ui/toast";

const RESEND_COOLDOWN_SECONDS = 30;

export function SetupWizard({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [confirming, startConfirming] = useTransition();
  const [sentOnce, setSentOnce] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function applySendResult(result: Awaited<ReturnType<typeof sendTwoFactorSetupOtp>>) {
    setSending(false);
    if (!result.ok) return setError(result.error);
    setError(undefined);
    setSentOnce(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function send() {
    setError(undefined);
    setSending(true);
    sendTwoFactorSetupOtp().then(applySendResult);
  }

  // Send the first code as soon as the page opens — one less click. Every setState call
  // this triggers happens inside the promise continuation, never synchronously in the
  // effect body itself, which is what the no-setState-in-effect rule actually checks for.
  useEffect(() => {
    sendTwoFactorSetupOtp().then(applySendResult);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function onConfirm(formData: FormData) {
    setError(undefined);
    startConfirming(async () => {
      const result = await withToast(confirmTwoFactorSetup(formData), "Two-factor authentication enabled");
      if (!result.ok) return setError(result.error);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-[13px] text-text-muted">
        {sentOnce ? (
          <>We&apos;ve emailed a 6-digit code to <strong className="text-text">{email}</strong>.</>
        ) : (
          "Sending a code…"
        )}
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <form action={onConfirm} className="grid gap-3" noValidate>
        <Field label="6-digit code" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" maxLength={6} pattern="\d{6}" required autoFocus className="text-center text-lg tracking-[0.3em]" />
        </Field>
        <Button type="submit" variant="primary" disabled={confirming} className="justify-center">
          {confirming ? "Verifying…" : "Confirm and finish"}
        </Button>
      </form>
      <button
        type="button"
        onClick={send}
        disabled={sending || cooldown > 0}
        className="justify-self-start text-[13px] text-primary underline underline-offset-2 hover:no-underline disabled:text-text-muted disabled:no-underline"
      >
        {cooldown > 0 ? `Resend code (${cooldown}s)` : sending ? "Sending…" : "Resend code"}
      </button>
    </div>
  );
}
