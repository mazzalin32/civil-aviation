import { formatDate } from "@/lib/time";

const LABELS: Record<string, string> = {
  "matter.create": "Case created",
  "matter.stage.move": "Stage moved",
  "matter.event.add": "Timeline event added",
  "matter.summary.update": "Summary edited",
  "matter.note.add": "Note added",
  "matter.note.update": "Note edited",
  "matter.note.delete": "Note deleted",
  "matter.party.add": "Party added",
  "matter.party.update": "Party edited",
  "matter.party.remove": "Party removed",
  "matter.reassign": "Team reassigned",
  "matter.hold": "Put on hold",
  "matter.resume": "Resumed",
  "matter.export": "Exported",
  "document.upload": "Document uploaded",
  "document.version.add": "New document version uploaded",
  "document.delete": "Document deleted",
  "document.restore": "Document restored",
  "document.purge": "Document permanently deleted",
  "document.upload.infected": "Upload blocked — virus scan flagged the file",
  "document.view": "Document viewed",
  "document.download": "Document downloaded",
  "document.print": "Document printed",
};

export type ActivityRow = { id: string; action: string; by: string; at: string; before?: unknown; after?: unknown };

export function ActivityTab({ entries, isAdmin }: { entries: ActivityRow[]; isAdmin: boolean }) {
  if (entries.length === 0) return <p className="m-0 text-[13px] text-text-muted">Nothing recorded yet.</p>;
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {entries.map((e) => (
        <li key={e.id} className="rounded-card border border-border p-3 text-[13px]">
          <p className="m-0">{LABELS[e.action] ?? e.action}</p>
          <p className="m-0 text-xs text-text-muted">
            {e.by} · {formatDate(new Date(e.at), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
          {isAdmin && (e.before != null || e.after != null) && (
            <pre className="m-0 mt-2 overflow-x-auto rounded-control bg-surface-muted p-2 text-[11px] text-text-muted">
              {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
