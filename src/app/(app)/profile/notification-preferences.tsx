"use client";

import { useState, useTransition } from "react";
import { Lock, Mail, Sunrise } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { withToast } from "@/components/ui/toast";
import { setDigestEnabled, setNotificationPreference } from "./actions";

export type PreferenceRow = {
  type: string;
  label: string;
  mutable: boolean;
  /** Which channels this type is sent on at all (Admin Settings → Reminders). */
  sendsInApp: boolean;
  sendsEmail: boolean;
  inApp: boolean;
  email: boolean;
};

type Channel = "inApp" | "email";

export function DigestSetting({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await withToast(setDigestEnabled({ enabled: next }), next ? "Daily digest turned on" : "Daily digest turned off");
      if ("error" in result) setEnabled(!next);
    });
  }

  return (
    <div className="flex items-start gap-3 rounded-control border border-border p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
        <Sunrise className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold">Daily digest email</p>
        <p className="m-0 mt-0.5 text-[13px] text-text-muted">
          At 7:00 AM: today&apos;s court dates, deadlines and tasks that are due or overdue, and your unread chat. Nothing is sent on a day with nothing to report.
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={change} disabled={pending} label="Daily digest email" className="mt-1" />
    </div>
  );
}

export function NotificationPreferences({ rows: initial, chatEmailDelay }: { rows: PreferenceRow[]; chatEmailDelay: number | null }) {
  const [rows, setRows] = useState(initial);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function change(type: string, channel: Channel, enabled: boolean) {
    const key = `${type}:${channel}`;
    const apply = (value: boolean) => setRows((rs) => rs.map((r) => (r.type === type ? { ...r, [channel]: value } : r)));
    apply(enabled);
    setPendingKey(key);
    startTransition(async () => {
      const result = await withToast(setNotificationPreference({ type, channel, enabled }), null);
      if ("error" in result) apply(!enabled);
      setPendingKey(null);
    });
  }

  const cell = (r: PreferenceRow, channel: Channel) => {
    const sends = channel === "inApp" ? r.sendsInApp : r.sendsEmail;
    if (!sends) return <span className="text-text-muted" title={channel === "email" ? "Not sent by email" : "Not shown in the app"}>—</span>;
    if (!r.mutable) return <Lock className="mx-auto size-3.5 text-text-muted" aria-label="Always on" />;
    const name = `${r.label}: ${channel === "email" ? "email" : "in the app"}`;
    return <Switch checked={r[channel]} onCheckedChange={(v) => change(r.type, channel, v)} disabled={pendingKey === `${r.type}:${channel}`} label={name} />;
  };

  const optional = rows.filter((r) => r.mutable);
  const locked = rows.filter((r) => !r.mutable);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-border py-2.5 pr-4 text-left text-xs font-medium text-text-muted">You are told when…</th>
                <th className="w-20 border-b border-border px-2 py-2.5 text-center text-xs font-medium text-text-muted">In the app</th>
                <th className="w-20 border-b border-border px-2 py-2.5 text-center text-xs font-medium text-text-muted">Email</th>
              </tr>
            </thead>
            <tbody>
              {optional.map((r) => (
                <tr key={r.type}>
                  <td className="border-b border-border py-3 pr-4">{r.label}</td>
                  <td className="border-b border-border px-2 py-3 text-center">{cell(r, "inApp")}</td>
                  <td className="border-b border-border px-2 py-3 text-center">{cell(r, "email")}</td>
                </tr>
              ))}
              {locked.length > 0 && (
                <tr>
                  <td colSpan={3} className="pt-5 pb-1.5">
                    <Badge tone="warning">
                      <Lock /> Always on
                    </Badge>
                    <span className="ml-2 text-xs text-text-muted">Court dates, deadlines and security alerts can&apos;t be turned off.</span>
                  </td>
                </tr>
              )}
              {locked.map((r) => (
                <tr key={r.type}>
                  <td className="border-b border-border py-3 pr-4 text-text-muted">{r.label}</td>
                  <td className="border-b border-border px-2 py-3 text-center">{cell(r, "inApp")}</td>
                  <td className="border-b border-border px-2 py-3 text-center">{cell(r, "email")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chatEmailDelay !== null && (
          <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            Chat emails (mentions, replies, new messages) are only sent if you still haven&apos;t read the message after {chatEmailDelay}{" "}
            {chatEmailDelay === 1 ? "minute" : "minutes"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
