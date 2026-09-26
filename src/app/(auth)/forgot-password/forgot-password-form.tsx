"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);

  if (state.done) {
    return <FormAlert tone="info">If that email has an account, a link to set a new password is on its way. It&apos;s valid for 72 hours.</FormAlert>;
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
