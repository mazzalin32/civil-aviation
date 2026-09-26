"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { verifyTwoFactorAction, type TwoFactorState } from "./actions";

const initialState: TwoFactorState = {};

export function TwoFactorForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyTwoFactorAction, initialState);
  const [useBackup, setUseBackup] = useState(false);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="method" value={useBackup ? "backup" : "totp"} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {useBackup ? (
        <Field label="Backup code" htmlFor="code" hint="One of the codes you saved when you set up 2FA.">
          <Input id="code" name="code" autoComplete="one-time-code" required autoFocus />
        </Field>
      ) : (
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
      )}
      <SubmitButton pendingLabel="Verifying…">Verify</SubmitButton>
      <button
        type="button"
        onClick={() => setUseBackup((v) => !v)}
        className="text-[13px] text-text-muted underline underline-offset-2 hover:text-text"
      >
        {useBackup ? "Use your authenticator app instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
