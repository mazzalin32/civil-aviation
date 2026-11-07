"use client";

import Link from "next/link";
import {
  Bell,
  Briefcase,
  CalendarClock,
  CheckSquare,
  FileText,
  GitCommitHorizontal,
  MessageSquare,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { stripMentionTokens } from "@/lib/mentions";
import type { NotificationItem } from "@/lib/notifications/item";

type Tone = "primary" | "warning" | "danger" | "neutral";

/** Label + icon + colour per notification type. Colours follow the status rules: blue = activity,
 *  amber = something coming due, red = needs attention now. Unknown types fall back to a plain bell. */
const TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  MESSAGE_MENTION: { label: "Mention", icon: MessageSquare, tone: "primary" },
  CASE_ASSIGNED: { label: "Case assigned", icon: Briefcase, tone: "primary" },
  TASK_ASSIGNED: { label: "Task assigned", icon: CheckSquare, tone: "primary" },
  DOCUMENT_UPLOADED: { label: "Document uploaded", icon: FileText, tone: "neutral" },
  STAGE_OR_CLOSURE_CHANGED: { label: "Case update", icon: GitCommitHorizontal, tone: "neutral" },
  HEARING_REMINDER: { label: "Hearing", icon: CalendarClock, tone: "warning" },
  DEADLINE_REMINDER: { label: "Deadline", icon: CalendarClock, tone: "warning" },
  HEARING_OUTCOME_MISSING: { label: "Outcome needed", icon: CalendarClock, tone: "danger" },
  SUSPICIOUS_ACTIVITY: { label: "Security alert", icon: ShieldAlert, tone: "danger" },
};

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
};

export function notificationMeta(type: string) {
  return TYPE_META[type] ?? { label: "Notification", icon: Bell, tone: "neutral" as Tone };
}

export function NotificationRow({ item, onActivate }: { item: NotificationItem; onActivate: (item: NotificationItem) => void }) {
  const { label, icon: Icon, tone } = notificationMeta(item.type);
  const unread = !item.readAt;

  const body = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted",
        unread && "bg-primary-soft/40",
      )}
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", unread ? TONE_CLASS[tone] : "bg-surface-muted text-text-muted")}>
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("text-[12px] font-semibold tracking-wide uppercase", unread ? "text-text" : "text-text-muted")}>{label}</span>
          {item.reference && (
            <span className="truncate rounded-full bg-surface-muted px-2 py-px text-[11px] font-medium text-text-muted tabular-nums">{item.reference}</span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-text-muted tabular-nums">{timeAgo(new Date(item.createdAt))}</span>
        </span>
        {/* stripMentionTokens: rows saved before the server started cleaning them still hold raw tokens. */}
        <span className={cn("mt-1 line-clamp-2 block text-[13px] leading-snug", unread ? "text-text" : "text-text-muted")}>
          {stripMentionTokens(item.message)}
        </span>
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </div>
  );

  return item.url ? (
    <Link href={item.url} role="menuitem" onClick={() => onActivate(item)} className="block">
      {body}
    </Link>
  ) : (
    <button type="button" role="menuitem" onClick={() => onActivate(item)} className="block w-full">
      {body}
    </button>
  );
}
