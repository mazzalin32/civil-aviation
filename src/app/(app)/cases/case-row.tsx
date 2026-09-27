"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/app/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatUGX } from "@/lib/time";

export type CaseRowData = {
  id: string;
  reference: string;
  title: string;
  categoryName: string;
  matterTypeName: string;
  stageName: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  amountClaimed: string | null; // BigInt serialized to string
  lead: { id: string; name: string } | null;
  supportCount: number;
  lastActivityAt: string;
};

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const STATUS_LABEL = { OPEN: "Open", ON_HOLD: "On hold", CLOSURE_REQUESTED: "Closure requested", CLOSED: "Closed" } as const;
const STATUS_TONE = { OPEN: "success", ON_HOLD: "warning", CLOSURE_REQUESTED: "info", CLOSED: "neutral" } as const;

export function CaseRow({ c }: { c: CaseRowData }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(`/cases/${c.id}`)} className="cursor-pointer hover:bg-surface-muted">
      <td className="border-b border-border px-4 py-3">
        <p className="m-0 font-medium">{c.title}</p>
        <p className="m-0 text-xs text-text-muted">{c.reference}</p>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-muted">
        <p className="m-0">{c.categoryName}</p>
        <p className="m-0 text-xs">{c.matterTypeName}</p>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-muted">{c.stageName ?? "—"}</td>
      <td className="border-b border-border px-4 py-3">
        <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority[0] + c.priority.slice(1).toLowerCase()}</Badge>
      </td>
      <td className="border-b border-border px-4 py-3 tabular-nums text-text-muted">{c.amountClaimed ? formatUGX(BigInt(c.amountClaimed)) : "—"}</td>
      <td className="border-b border-border px-4 py-3">
        {c.lead ? (
          <div className="flex items-center gap-2">
            <Avatar name={c.lead.name} seed={c.lead.id} />
            <div>
              <p className="m-0 text-[13px]">{c.lead.name}</p>
              {c.supportCount > 0 && <p className="m-0 text-xs text-text-muted">+{c.supportCount} support</p>}
            </div>
          </div>
        ) : (
          <span className="text-text-muted">Unassigned</span>
        )}
      </td>
      <td className="border-b border-border px-4 py-3">
        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-muted">{formatDate(new Date(c.lastActivityAt))}</td>
    </tr>
  );
}
