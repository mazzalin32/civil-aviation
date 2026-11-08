"use client";

import { useState, useTransition } from "react";
import { Mail, Pencil, UserPlus } from "lucide-react";
import type { AccountStatus } from "@/lib/invite-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import { Avatar } from "@/components/app/avatar";
import { updateOrganization, inviteAdmin, resendAdminInvite } from "../actions";
import { withToast } from "@/components/ui/toast";

export type AdminRow = { id: string; name: string; email: string; status: AccountStatus };

export function OrgPanel({
  organizationId,
  name,
  logoUrl,
  primaryColor,
  admins,
}: {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  admins: AdminRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="m-0 text-base font-semibold">Branding</h2>
          <Button type="button" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        </div>
        <dl className="m-0 grid gap-2.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Name</dt>
            <dd className="m-0 font-medium">{name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Logo</dt>
            <dd className="m-0 max-w-[60%] truncate font-medium">{logoUrl ?? "Default"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-muted">Primary colour</dt>
            <dd className="m-0 flex items-center gap-2 font-medium">
              {primaryColor && <span aria-hidden className="size-3.5 rounded-full border border-border" style={{ backgroundColor: primaryColor }} />}
              {primaryColor ?? "Default"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="m-0 text-base font-semibold">Admins</h2>
          <Button type="button" size="sm" className="ml-auto" onClick={() => setInviting(true)}>
            <UserPlus className="size-3.5" /> Invite
          </Button>
        </div>
        {admins.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">No Admin invited yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {admins.map((a) => (
              <AdminItem key={a.id} admin={a} />
            ))}
          </ul>
        )}
      </div>

      <BrandingEditor organizationId={organizationId} name={name} logoUrl={logoUrl} primaryColor={primaryColor} open={editing} onClose={() => setEditing(false)} />
      <InviteAdminDialog organizationId={organizationId} open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

function AdminItem({ admin }: { admin: AdminRow }) {
  const [pending, startTransition] = useTransition();
  const { status } = admin;
  return (
    <li className="flex items-start gap-2.5 text-[13px]">
      <Avatar name={admin.name} seed={admin.id} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-medium">{admin.name}</p>
        <p className="m-0 truncate text-[12px] text-text-muted">{admin.email}</p>
        {status.detail && <p className="m-0 mt-0.5 text-[12px] text-text-muted">{status.detail}</p>}
        {status.canResend && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await withToast(resendAdminInvite(admin.id), "Invite sent again");
              })
            }
            className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            <Mail className="size-3.5" /> {pending ? "Sending…" : "Resend invite"}
          </button>
        )}
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </li>
  );
}

function BrandingEditor({
  organizationId,
  name,
  logoUrl,
  primaryColor,
  open,
  onClose,
}: {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(updateOrganization({ id: organizationId, ...Object.fromEntries(formData) }), "Branding saved");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Edit branding">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Organisation name" htmlFor="eo-name">
          <Input id="eo-name" name="name" defaultValue={name} />
        </Field>
        <Field label="Logo URL" htmlFor="eo-logo" hint="Leave blank to use the default.">
          <Input id="eo-logo" name="logoUrl" type="url" defaultValue={logoUrl ?? ""} placeholder="https://…" />
        </Field>
        <Field label="Primary colour" htmlFor="eo-color" hint="Hex colour, e.g. #4169E1. Leave blank to use the platform default.">
          <Input id="eo-color" name="primaryColor" defaultValue={primaryColor ?? ""} placeholder="#4169E1" />
        </Field>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}

function InviteAdminDialog({ organizationId, open, onClose }: { organizationId: string; open: boolean; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(inviteAdmin({ organizationId, ...Object.fromEntries(formData) }), "Invite sent");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Invite an Admin">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Name" htmlFor="ia-name">
          <Input id="ia-name" name="name" autoFocus />
        </Field>
        <Field label="Email" htmlFor="ia-email">
          <Input id="ia-email" name="email" type="email" />
        </Field>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Sending…" : "Send invite"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
