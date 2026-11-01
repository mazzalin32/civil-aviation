"use client";

import { useActionState, useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { verifyTwoFactorAction, resendTwoFactorOtp, type TwoFactorState } from "./actions";

const initialState: TwoFactorState = {};
const RESEND_COOLDOWN_SECONDS = 30;

export function TwoFactorForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyTwoFactorAction, initialState);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function resend() {
    setResendError(undefined);
    setResending(true);
    const result = await resendTwoFactorOtp();
    setResending(false);
    if (!result.ok) return setResendError(result.error);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {resendError && <FormAlert>{resendError}</FormAlert>}
      <Field label="6-digit code" htmlFor="code">
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          autoFocus
          className="text-center text-lg tracking-[0.3em]"
        />
      </Field>
      <SubmitButton pendingLabel="Verifying…">Verify</SubmitButton>
      <button
        type="button"
        onClick={resend}
        disabled={resending || cooldown > 0}
        className="justify-self-start text-[13px] text-text-muted underline underline-offset-2 hover:text-text disabled:no-underline"
      >
        {cooldown > 0 ? `Resend code (${cooldown}s)` : resending ? "Sending…" : "Didn't get it? Resend code"}
      </button>
    </form>
  );
}
