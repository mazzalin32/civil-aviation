"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password} hint="At least 10 characters, and not one found in a public breach.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
