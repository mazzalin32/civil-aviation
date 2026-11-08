"use client";

import Link from "next/link";
import { useRef } from "react";
import { X, UserCircle2, Building2, Clock } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { UserFilters } from "./filters";

/** Plain GET form — filters live in the URL, so a filtered view is bookmarkable/shareable. */
export function UserFiltersBar({ filters, departments }: { filters: UserFilters; departments: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasFilters = Boolean(filters.status || filters.department || filters.certExpiring);

  return (
    <form ref={formRef} className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
      <Select
        name="status"
        icon={UserCircle2}
        defaultValue={filters.status ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-auto min-w-[160px]"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="invited">Invited</option>
        <option value="expired">Invite expired</option>
        <option value="deactivated">Deactivated</option>
      </Select>
      <Select
        name="department"
        icon={Building2}
        defaultValue={filters.department ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-auto min-w-[180px]"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <label className="flex h-10 items-center gap-2 border border-transparent px-1 text-[13px] text-text-muted">
        <input
          type="checkbox"
          name="certExpiring"
          value="1"
          defaultChecked={filters.certExpiring === "1"}
          onChange={() => formRef.current?.requestSubmit()}
          className="size-4 accent-primary"
        />
        <Clock className="size-4" />
        Cert expiring soon
      </label>
      {hasFilters && (
        <Link href="/users" className="ml-auto flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          <X className="size-3.5" /> Clear filters
        </Link>
      )}
    </form>
  );
}
