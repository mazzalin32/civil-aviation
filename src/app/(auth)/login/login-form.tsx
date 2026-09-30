"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

/** Clean, label-less fields (placeholder text carries the label) — the look the client
 *  pointed to for this screen. Real <label>s stay for screen readers via sr-only.
 *  No ring/glow and no full-border colour change on focus — just the bottom edge tints
 *  blue, the way the reference screen does it, while the field stays white throughout. */
const fieldClass =
  "h-12 rounded-md px-4 text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border focus-visible:border-b-primary";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="grid gap-3.5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email address"
          required
          autoFocus
          className={fieldClass}
        />
        {state.fieldErrors?.email && <p className="m-0 mt-1.5 text-xs text-danger">{state.fieldErrors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" placeholder="Password" required className={fieldClass} />
        {state.fieldErrors?.password && <p className="m-0 mt-1.5 text-xs text-danger">{state.fieldErrors.password}</p>}
      </div>
      <SubmitButton pendingLabel="Signing in…" className="mt-1.5 h-12 rounded-md text-[13px] font-semibold tracking-wide uppercase">
        Sign in
      </SubmitButton>
    </form>
  );
}
