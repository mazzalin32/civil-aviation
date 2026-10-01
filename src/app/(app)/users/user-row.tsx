"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, CheckCircle2, LogOut, Mail, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Avatar } from "@/components/app/avatar";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteUser, resendInvite, signOutAllSessions, toggleUserActive, updateLawyer } from "./actions";

export type UserRowData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  department: string | null;
  practisingCertNo: string | null;
  certExpiry: string | null; // ISO date
  isActive: boolean;
  hasAccount: boolean;
  isSelf: boolean;
};

function certBadge(certExpiry: string | null) {
  if (!certExpiry) return null;
  const days = Math.ceil((new Date(certExpiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <Badge tone="danger">Cert expired</Badge>;
  if (days <= 60) return <Badge tone="warning">Cert expires in {days}d</Badge>;
  return null;
}

export function UserRowItem({ user }: { user: UserRowData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function save(formData: FormData) {
    formData.set("id", user.id);
    setError(undefined);
    startTransition(async () => {
      const result = await updateLawyer(formData);
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="bg-primary-soft/40">
        <td className="border-b border-border px-4 py-3" colSpan={5}>
          <form action={save} className="grid gap-3">
            {error && <p className="m-0 text-xs text-danger">{error}</p>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input name="name" defaultValue={user.name} placeholder="Full name" className="h-9" required />
              <Input name="phone" defaultValue={user.phone ?? ""} placeholder="Phone" className="h-9" />
              <Input name="title" defaultValue={user.title ?? ""} placeholder="Title" className="h-9" />
              <Input name="department" defaultValue={user.department ?? ""} placeholder="Department" className="h-9" />
              <Input name="practisingCertNo" defaultValue={user.practisingCertNo ?? ""} placeholder="Practising cert. no." className="h-9" />
              <Input name="certExpiry" type="date" defaultValue={user.certExpiry?.slice(0, 10) ?? ""} className="h-9" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" disabled={pending}>
                <Check className="size-4" /> Save
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  const status = !user.isActive ? { tone: "neutral" as const, label: "Deactivated" } : user.hasAccount ? { tone: "success" as const, label: "Active" } : { tone: "warning" as const, label: "Invited" };

  return (
    <tr
      onClick={() => router.push(`/users/${user.id}`)}
      className={cn("cursor-pointer hover:bg-surface-muted", !user.isActive && "opacity-60")}
    >
      <td className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} seed={user.id} />
          <div className="min-w-0 leading-tight">
            <b className="block truncate font-medium">{user.name}</b>
            <small className="block truncate text-xs text-text-muted">{user.email}</small>
          </div>
        </div>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-muted">
        {user.title ?? "—"}
        {user.department && <span className="block text-xs">{user.department}</span>}
      </td>
      <td className="border-b border-border px-4 py-3 text-text-muted">
        {user.practisingCertNo ?? "—"}
        {certBadge(user.certExpiry) ?? (user.certExpiry && <span className="block text-xs">{formatDate(new Date(user.certExpiry))}</span>)}
      </td>
      <td className="border-b border-border px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td className="border-b border-border px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <RowActionsMenu
          actions={[
            { label: "Edit", icon: Pencil, onClick: () => setEditing(true) },
            ...(!user.hasAccount && user.isActive
              ? [{ label: "Resend invite", icon: Mail, disabled: pending, onClick: () => startTransition(() => resendInvite(user.id)) }]
              : []),
            { label: "Sign out all sessions", icon: LogOut, disabled: pending, onClick: () => startTransition(() => signOutAllSessions(user.id)) },
            { kind: "separator" as const },
            {
              label: user.isActive ? "Deactivate" : "Reactivate",
              icon: user.isActive ? Ban : CheckCircle2,
              danger: user.isActive,
              disabled: pending || user.isSelf,
              onClick: () => {
                if (user.isActive && !window.confirm(`Deactivate ${user.name}? They'll be signed out everywhere immediately.`)) return;
                startTransition(async () => {
                  const result = await toggleUserActive(user.id, !user.isActive);
                  if (result?.error) window.alert(result.error);
                });
              },
            },
            {
              label: "Delete user",
              icon: Trash2,
              danger: true,
              disabled: pending || user.isSelf,
              onClick: () => {
                if (!window.confirm(`Delete ${user.name}? They will be removed from the Users list, signed out everywhere and unable to sign in. Their history on cases is kept. You can restore them later by adding the same email again.`)) return;
                startTransition(async () => {
                  const result = await deleteUser(user.id);
                  if (result?.error) window.alert(result.error);
                });
              },
            },
          ]}
        />
      </td>
    </tr>
  );
}
