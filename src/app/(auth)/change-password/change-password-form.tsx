"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <Field label="Current password" htmlFor="currentPassword" error={state.fieldErrors?.currentPassword}>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required autoFocus />
      </Field>
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password} hint="At least 10 characters, and not one found in a public breach.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
