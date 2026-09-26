"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import { beginTwoFactorSetup, confirmTwoFactorSetup } from "./actions";

type Step = { name: "password" } | { name: "scan"; qrDataUrl: string; secretUri: string; backupCodes: string[] };

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function onPassword(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await beginTwoFactorSetup(formData);
      if (!result.ok) return setError(result.error);
      setStep({ name: "scan", qrDataUrl: result.qrDataUrl, secretUri: result.secretUri, backupCodes: result.backupCodes });
    });
  }

  function onConfirm(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await confirmTwoFactorSetup(formData);
      if (!result.ok) return setError(result.error);
      router.push("/");
      router.refresh();
    });
  }

  async function copyBackupCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard can be unavailable; the codes are already visible to copy by hand.
    }
  }

  if (step.name === "password") {
    return (
      <form action={onPassword} className="grid gap-4" noValidate>
        <p className="m-0 text-[13px] text-text-muted">Confirm your password to set up two-factor authentication.</p>
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </Field>
        <Button type="submit" variant="primary" disabled={pending} className="justify-center">
          {pending ? "Please wait…" : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="m-0 mb-2 text-[13px] font-medium">1. Scan this with your authenticator app</p>
        <div className="grid place-items-center rounded-control border border-border bg-surface-muted p-4">
          <Image src={step.qrDataUrl} alt="Scan with an authenticator app" width={180} height={180} unoptimized />
        </div>
        <p className="m-0 mt-2 text-xs break-all text-text-muted">Can&apos;t scan? Enter this key manually: {new URL(step.secretUri).searchParams.get("secret")}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="m-0 text-[13px] font-medium">2. Save your backup codes</p>
          <button
            type="button"
            onClick={() => copyBackupCodes(step.backupCodes)}
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="size-3.5" /> {copied ? "Copied" : "Copy all"}
          </button>
        </div>
        <p className="m-0 mb-2 text-xs text-text-muted">Use one of these to sign in if you lose access to your authenticator app. Each works once.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-control border border-border bg-surface-muted p-3 font-mono text-[13px] tabular-nums">
          {step.backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
      </div>

      <form action={onConfirm} className="grid gap-3" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="3. Enter the 6-digit code from your app" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" maxLength={6} pattern="\d{6}" required className="text-center text-lg tracking-[0.3em]" />
        </Field>
        <Button type="submit" variant="primary" disabled={pending} className="justify-center">
          {pending ? "Verifying…" : "Confirm and finish"}
        </Button>
      </form>
    </div>
  );
}
