"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { activateAction, type ActivateState } from "./actions";

const initialState: ActivateState = {};

export function ActivateForm({ token, submitLabel }: { token: string; submitLabel: string }) {
  const [state, action] = useActionState(activateAction, initialState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password} hint="At least 10 characters, and not one found in a public breach.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingLabel="Saving password…">{submitLabel}</SubmitButton>
    </form>
  );
}
