"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, FileText, ListChecks, MessageSquare, Pencil, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/app/avatar";
import { SlideOver } from "@/components/ui/slide-over";
import { formatDate, formatUGX } from "@/lib/time";
import { UCAA_POSITIONS } from "@/lib/validation/matter";
import { updateSummary } from "./actions";
import { IntakeDetails, StatusBanner, type Intake, type StatusInfo } from "./overview-details";

export type KeyFacts = {
  amountClaimed: string | null;
  ucaaRole: string;
  judge: string | null;
  opposingCounsel: string | null;
  categoryName: string;
  lastActivityAt: string;
};

export type Snapshot = {
  statusLabel: string;
  priorityLabel: string;
  stageName: string | null;
  stageIndex: number;
  stageTotal: number;
  daysOpen: number;
  openTasks: number;
  overdueTasks: number;
  documents: number;
  messages: number;
  nextDeadline: { title: string; dueAt: string } | null;
};

function Tile({ href, icon: Icon, label, value, hint, tone }: { href: string; icon: typeof FileText; label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <Link
      href={href}
      className="group min-w-0 rounded-[12px] border border-border bg-surface-muted px-3.5 py-3 transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
        <Icon className="size-3.5" strokeWidth={1.8} /> {label}
      </span>
      <span className="mt-1 block truncate text-[15px] font-semibold tabular-nums" title={value}>{value}</span>
      {hint && <span className={`block truncate text-[12px] ${tone === "danger" ? "text-danger" : "text-text-muted"}`} title={hint}>{hint}</span>}
    </Link>
  );
}

export function CatchUpPanel({
  matterId,
  snapshot,
  status,
  intake,
  summary,
  pinnedMessage,
  facts,
  team,
  canMutate,
  deadlines,
}: {
  matterId: string;
  snapshot: Snapshot;
  status: StatusInfo;
  intake: Intake;
  summary: { body: string; authorName: string; createdAt: string } | null;
  pinnedMessage: { body: string; authorName: string; createdAt: string } | null;
  facts: KeyFacts;
  team: { id: string; name: string; role: "LEAD" | "SUPPORT" }[];
  canMutate: boolean;
  deadlines: { id: string; title: string; dueAt: string; isCritical: boolean }[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [now] = useState(() => Date.now());

  function save(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await updateSummary({ matterId, body: formData.get("body") });
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-base font-semibold">Overview</h2>
        </div>
        <StatusBanner info={status} now={now} />
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Tile
            href={`/cases/${matterId}?tab=hearings`}
            icon={CalendarClock}
            label="Next deadline"
            value={snapshot.nextDeadline ? formatDate(new Date(snapshot.nextDeadline.dueAt)) : "None open"}
            hint={snapshot.nextDeadline?.title}
            tone={snapshot.nextDeadline && new Date(snapshot.nextDeadline.dueAt).getTime() < now ? "danger" : undefined}
          />
          <Tile
            href={`/cases/${matterId}?tab=tasks`}
            icon={ListChecks}
            label="Open tasks"
            value={String(snapshot.openTasks)}
            hint={snapshot.overdueTasks > 0 ? `${snapshot.overdueTasks} overdue` : "None overdue"}
            tone={snapshot.overdueTasks > 0 ? "danger" : undefined}
          />
          <Tile href={`/cases/${matterId}?tab=documents`} icon={FileText} label="Documents" value={String(snapshot.documents)} hint="On file" />
          <Tile
            href={`/cases/${matterId}?tab=discussion`}
            icon={MessageSquare}
            label="Discussion"
            value={String(snapshot.messages)}
            hint={`Open ${snapshot.daysOpen} day${snapshot.daysOpen === 1 ? "" : "s"}`}
          />
        </div>
        <div className="mb-5">
          <IntakeDetails intake={intake} now={now} />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[12px] font-semibold tracking-[0.06em] text-text-muted uppercase">Summary</h3>
          {summary && (
            <span className="text-xs text-text-muted">
              Edited by {summary.authorName} · {formatDate(new Date(summary.createdAt))}
            </span>
          )}
          {canMutate && (
            <Button type="button" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit summary
            </Button>
          )}
        </div>
        {summary ? (
          <div className="grid gap-2 text-[13.5px] whitespace-pre-wrap">{summary.body}</div>
        ) : (
          <p className="m-0 text-[13px] text-text-muted">
            {canMutate ? "No summary written yet — click \"Edit summary\" to add one." : "No summary written yet."}
          </p>
        )}
        {pinnedMessage && (
          <div className="mt-3 flex items-start gap-2.5 rounded-[12px] bg-surface-muted px-3.5 py-3 text-[13px]">
            <Pin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="m-0 whitespace-pre-wrap">{pinnedMessage.body}</p>
              <span className="text-[12px] text-text-muted">
                Pinned from discussion · {pinnedMessage.authorName} · {formatDate(new Date(pinnedMessage.createdAt))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid content-start gap-4">
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="m-0 mb-3 text-base font-semibold">Key facts</h2>
          <dl className="m-0 grid gap-2.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Amount claimed</dt>
              <dd className="m-0 text-right font-medium tabular-nums">{facts.amountClaimed ? formatUGX(BigInt(facts.amountClaimed)) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">UCAA role</dt>
              <dd className="m-0 text-right font-medium">{UCAA_POSITIONS.find((r) => r.value === facts.ucaaRole)?.label ?? facts.ucaaRole}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Judge</dt>
              <dd className="m-0 text-right font-medium">{facts.judge ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Opposing counsel</dt>
              <dd className="m-0 text-right font-medium">{facts.opposingCounsel ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Category</dt>
              <dd className="m-0 text-right font-medium">{facts.categoryName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Last activity</dt>
              <dd className="m-0 text-right font-medium">{formatDate(new Date(facts.lastActivityAt))}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="m-0 mb-3 text-base font-semibold">Deadlines</h2>
          {deadlines.length === 0 ? (
            <p className="m-0 text-[13px] text-text-muted">No open deadlines on this case.</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {deadlines.map((d) => {
                const overdue = new Date(d.dueAt).getTime() < now;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate">{d.title}</span>
                    <Badge tone={overdue ? "danger" : d.isCritical ? "warning" : "neutral"}>
                      {overdue ? "Overdue" : formatDate(new Date(d.dueAt))}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="m-0 mb-3 text-base font-semibold">Team</h2>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {team.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[13px]">
                <Avatar name={t.name} seed={t.id} />
                <span className="flex-1">{t.name}</span>
                <Badge tone={t.role === "LEAD" ? "info" : "neutral"}>{t.role === "LEAD" ? "Lead" : "Support"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SlideOver open={editing} onClose={() => setEditing(false)} title="Edit summary">
        <form action={save} className="grid gap-4">
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          <textarea
            name="body"
            rows={10}
            autoFocus
            defaultValue={summary?.body ?? "What it's about.\n\nWhere it stands.\n\nWhat's next."}
            className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
          <p className="m-0 text-xs text-text-muted">Previous versions are kept — this adds a new one rather than overwriting.</p>
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
