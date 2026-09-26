"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export type ForgotPasswordState = { done?: boolean; fieldErrors?: Record<string, string> };

/** Always the same outcome either way — never reveals whether the email exists (spec, FLOWS §2). */
export async function forgotPasswordAction(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email." } };

  await auth.api.requestPasswordReset({
    body: { email: parsed.data.email, redirectTo: "/activate" },
    headers: await headers(),
    asResponse: false,
  });
  return { done: true };
}
