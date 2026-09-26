"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
