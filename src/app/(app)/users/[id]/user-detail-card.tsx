"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, CheckCircle2, LogOut, Mail, Pencil, ShieldCheck, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/time";
import type { AccountStatus } from "@/lib/invite-status";
import { resendInvite, signOutAllSessions, toggleUserActive, updateLawyer } from "../actions";
import { toast, withToast } from "@/components/ui/toast";

export type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  department: string | null;
  practisingCertNo: string | null;
  certExpiry: string | null;
  role: "ADMIN" | "LAWYER";
  isActive: boolean;
  status: AccountStatus;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13.5px] last:border-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 text-right font-medium">{value}</dd>
    </div>
  );
}

export function UserDetailCard({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function save(formData: FormData) {
    formData.set("id", user.id);
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(updateLawyer(formData), "User updated");
      if (result?.error) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  const { status } = user;

  if (editing) {
    return (
      <div className="p-5">
        <form action={save} className="grid gap-4">
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="ed-name">
              <Input id="ed-name" name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Phone" htmlFor="ed-phone">
              <Input id="ed-phone" name="phone" defaultValue={user.phone ?? ""} />
            </Field>
            <Field label="Title" htmlFor="ed-title">
              <Input id="ed-title" name="title" defaultValue={user.title ?? ""} />
            </Field>
            <Field label="Department" htmlFor="ed-department">
              <Input id="ed-department" name="department" defaultValue={user.department ?? ""} />
            </Field>
            <Field label="Practising certificate no." htmlFor="ed-cert">
              <Input id="ed-cert" name="practisingCertNo" defaultValue={user.practisingCertNo ?? ""} />
            </Field>
            <Field label="Certificate expiry" htmlFor="ed-expiry">
              <Input id="ed-expiry" name="certExpiry" type="date" defaultValue={user.certExpiry?.slice(0, 10) ?? ""} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              <Check className="size-4" /> Save
            </Button>
            <Button type="button" onClick={() => setEditing(false)} disabled={pending}>
              <X className="size-4" /> Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} seed={user.id} className="size-12 text-base" />
          <div>
            <h1 className="m-0 font-serif text-xl font-semibold">{user.name}</h1>
            <p className="m-0 text-[13px] text-text-muted">{user.title ?? user.role}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          {status.canResend && (
            <Button
              variant={status.key === "expired" ? "primary" : "secondary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await withToast(resendInvite(user.id), "Invitation sent again");
                  if (!result?.error) router.refresh();
                })
              }
            >
              <Mail className="size-4" /> Resend invite
            </Button>
          )}
          <Button disabled={pending} onClick={() => startTransition(() => withToast(signOutAllSessions(user.id), "Signed out of all sessions"))}>
            <LogOut className="size-4" /> Sign out sessions
          </Button>
          <Button
            variant={user.isActive ? "danger" : "secondary"}
            disabled={pending || user.isSelf}
            onClick={() => {
              if (user.isActive && !window.confirm(`Deactivate ${user.name}? They'll be signed out everywhere immediately.`)) return;
              startTransition(async () => {
                const result = await withToast(toggleUserActive(user.id, !user.isActive), "User status updated");
                if (result?.error) toast.error(result.error);
                else router.refresh();
              });
            }}
          >
            {user.isActive ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
            {user.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>

      <dl className="m-0 grid gap-0">
        <Fact label="Email" value={user.email} />
        <Fact label="Phone" value={user.phone ?? "—"} />
        <Fact label="Department" value={user.department ?? "—"} />
        <Fact label="Role" value={user.role === "ADMIN" ? "Admin" : "Lawyer"} />
        <Fact
          label="Status"
          value={
            <span className="inline-flex flex-col items-end gap-1">
              <Badge tone={status.tone}>{status.label}</Badge>
              {status.detail && <span className="text-xs font-normal text-text-muted">{status.detail}</span>}
            </span>
          }
        />
        <Fact
          label="Practising certificate"
          value={
            user.practisingCertNo
              ? `${user.practisingCertNo}${user.certExpiry ? ` · expires ${formatDate(new Date(user.certExpiry))}` : ""}`
              : "—"
          }
        />
        <Fact
          label="Two-factor authentication"
          value={
            user.twoFactorEnabled ? (
              <span className="inline-flex items-center gap-1 text-success">
                <ShieldCheck className="size-3.5" /> Enabled
              </span>
            ) : (
              "Not set up yet"
            )
          }
        />
        <Fact label="Last signed in" value={user.lastLoginAt ? formatDate(new Date(user.lastLoginAt)) : "Never"} />
        <Fact label="Account created" value={formatDate(new Date(user.createdAt))} />
      </dl>
    </div>
  );
}
