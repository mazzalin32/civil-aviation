import { formatDate } from "@/lib/time";

const LABELS: Record<string, string> = {
  "user.create": "Account created",
  "user.invite.sent": "Invite sent",
  "user.invite.resent": "Invite resent",
  "user.update": "Details updated",
  "user.deactivate": "Deactivated",
  "user.reactivate": "Reactivated",
  "user.sessions.revoked": "Signed out of all sessions",
  "user.login": "Signed in",
  "user.login.failed": "Failed sign-in attempt",
  "user.login.locked": "Account locked (too many failed attempts)",
  "user.password.changed": "Password changed",
  "user.password.activated": "Invite accepted — account activated",
  "user.password.reset": "Password reset by email link",
  "user.welcome.dismissed": "Closed the welcome card",
  "user.restore": "Account restored",
  "user.delete": "Deleted",
  "user.2fa.enabled": "Two-factor authentication enabled",
};

export function ActivityList({ entries }: { entries: { id: string; action: string; by: string; at: string }[] }) {
  if (entries.length === 0) return <p className="m-0 text-[13px] text-text-muted">Nothing recorded yet.</p>;
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {entries.map((e) => (
        <li key={e.id} className="text-[13px]">
          <p className="m-0">{LABELS[e.action] ?? e.action}</p>
          <p className="m-0 text-xs text-text-muted">
            {e.by} · {formatDate(new Date(e.at), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        </li>
      ))}
    </ul>
  );
}
