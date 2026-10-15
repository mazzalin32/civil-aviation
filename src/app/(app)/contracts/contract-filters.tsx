"use client";

import Link from "next/link";
import { useRef } from "react";
import { Search, X, Tag, Building2, GitCommitHorizontal, Landmark, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ContractFilters } from "./filters";

export type ContractFilterOptions = {
  categories: { id: string; name: string }[];
  departments: string[];
  stages: string[];
  agVettingStatuses: { id: string; label: string }[];
  internalApprovalStatuses: { id: string; label: string }[];
};

export function ContractFiltersBar({ filters, options }: { filters: ContractFilters; options: ContractFilterOptions }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  const hasFilters = Boolean(filters.q || filters.categoryId || filters.department || filters.stage || filters.agVettingStatusId || filters.internalApprovalStatusId);

  return (
    <form ref={formRef} className="mb-4 grid gap-3 rounded-card border border-border bg-surface-muted/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Input name="q" icon={Search} defaultValue={filters.q ?? ""} placeholder="Search contracts by reference, title, parties…" onBlur={submit} />
        </div>
        <Select name="categoryId" icon={Tag} defaultValue={filters.categoryId ?? ""} onChange={submit} className="w-auto min-w-[160px]">
          <option value="">All contract types</option>
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select name="department" icon={Building2} defaultValue={filters.department ?? ""} onChange={submit} className="w-auto min-w-[160px]">
          <option value="">All departments</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Select name="stage" icon={GitCommitHorizontal} defaultValue={filters.stage ?? ""} onChange={submit} className="w-auto min-w-[150px]">
          <option value="">All stages</option>
          {options.stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select name="agVettingStatusId" icon={Landmark} defaultValue={filters.agVettingStatusId ?? ""} onChange={submit} className="w-auto min-w-[160px]">
          <option value="">All AG statuses</option>
          {options.agVettingStatuses.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
        <Select name="internalApprovalStatusId" icon={ShieldCheck} defaultValue={filters.internalApprovalStatusId ?? ""} onChange={submit} className="w-auto min-w-[170px]">
          <option value="">All approval statuses</option>
          {options.internalApprovalStatuses.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>

        {hasFilters && (
          <Link href="/contracts" className="ml-auto flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            <X className="size-3.5" /> Clear filters
          </Link>
        )}
        <button type="submit" className="sr-only">Apply</button>
      </div>
    </form>
  );
}
