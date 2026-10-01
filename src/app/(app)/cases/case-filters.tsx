"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown, Layers, GitCommitHorizontal, Tag, GitBranch, Landmark, UserCheck, Flag, Scale, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UCAA_POSITIONS } from "@/lib/validation/matter";
import type { CaseFilters } from "./filters";

export type CaseFilterOptions = {
  categories: { id: string; name: string }[];
  matterTypes: { id: string; name: string }[];
  forums: { id: string; name: string }[];
  lawyers: { id: string; name: string }[];
  stages: string[];
};

export function CaseFiltersBar({ filters, options }: { filters: CaseFilters; options: CaseFilterOptions }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  const moreCount = [
    filters.stage,
    filters.categoryId,
    filters.matterTypeId,
    filters.forumId,
    filters.ucaaRole,
    filters.valueMin,
    filters.valueMax,
    filters.preset,
  ].filter(Boolean).length;
  const [showMore, setShowMore] = useState(moreCount > 0);

  const hasFilters = Boolean(
    filters.status || filters.stage || filters.categoryId || filters.matterTypeId || filters.forumId || filters.lawyerId || filters.priority || filters.ucaaRole || filters.preset,
  );

  return (
    <form ref={formRef} className="grid gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
      <input type="hidden" name="sort" value={filters.sort} />
      <input type="hidden" name="dir" value={filters.dir} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Input name="q" icon={Search} defaultValue={filters.q ?? ""} placeholder="Search title, reference, court no., ECCMIS, parties…" />
        </div>
        <Select name="status" icon={Layers} defaultValue={filters.status ?? ""} onChange={submit} className="w-auto min-w-[150px]">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CLOSURE_REQUESTED">Closure requested</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select name="priority" icon={Flag} defaultValue={filters.priority ?? ""} onChange={submit} className="w-auto min-w-[140px]">
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        {options.lawyers.length > 0 && (
          <Select name="lawyerId" icon={UserCheck} defaultValue={filters.lawyerId ?? ""} onChange={submit} className="w-auto min-w-[160px]">
            <option value="">All lawyers</option>
            {options.lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}

        <Button type="button" onClick={() => setShowMore((s) => !s)} className="gap-1.5">
          <SlidersHorizontal className="size-4" />
          More filters
          {moreCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-on-primary">{moreCount}</span>}
          <ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} />
        </Button>

        {hasFilters || filters.q ? (
          <Link href="/cases" className="ml-auto flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            <X className="size-3.5" /> Clear filters
          </Link>
        ) : null}
        <button type="submit" className="sr-only">
          Apply
        </button>
      </div>

      {showMore && (
        <div className="grid gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select name="stage" icon={GitCommitHorizontal} defaultValue={filters.stage ?? ""} onChange={submit} className="w-auto min-w-[160px]">
              <option value="">All stages</option>
              {options.stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select name="categoryId" icon={Tag} defaultValue={filters.categoryId ?? ""} onChange={submit} className="w-auto min-w-[170px]">
              <option value="">All categories</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="matterTypeId" icon={GitBranch} defaultValue={filters.matterTypeId ?? ""} onChange={submit} className="w-auto min-w-[170px]">
              <option value="">All matter types</option>
              {options.matterTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select name="forumId" icon={Landmark} defaultValue={filters.forumId ?? ""} onChange={submit} className="w-auto min-w-[170px]">
              <option value="">All courts</option>
              {options.forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select name="ucaaRole" icon={Scale} defaultValue={filters.ucaaRole ?? ""} onChange={submit} className="w-auto min-w-[150px]">
              <option value="">All UCAA roles</option>
              {UCAA_POSITIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input name="valueMin" defaultValue={filters.valueMin ?? ""} placeholder="Min value (UGX)" className="w-[150px]" onBlur={submit} />
            <Input name="valueMax" defaultValue={filters.valueMax ?? ""} placeholder="Max value (UGX)" className="w-[150px]" onBlur={submit} />
            <span className="h-6 w-px bg-border" />
            <Select name="dateField" icon={Calendar} defaultValue={filters.dateField} onChange={submit} className="w-auto min-w-[140px]">
              <option value="lastActivityAt">Last activity</option>
              <option value="createdAt">Opened</option>
              <option value="closedAt">Closed</option>
            </Select>
            <Select name="preset" defaultValue={filters.preset ?? ""} onChange={submit} className="w-auto min-w-[140px]">
              <option value="">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="custom">Custom range</option>
            </Select>
            {filters.preset === "custom" && (
              <>
                <Input type="date" name="from" defaultValue={filters.from ?? ""} onChange={submit} className="w-auto" />
                <span className="text-text-muted">–</span>
                <Input type="date" name="to" defaultValue={filters.to ?? ""} onChange={submit} className="w-auto" />
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
