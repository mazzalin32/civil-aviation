import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { formatDate, formatUGX } from "@/lib/time";
import { buildCaseOrderBy, buildCaseWhere, parseCaseFilters, PRIORITY_RANK } from "@/app/(app)/cases/filters";
import { createReportDocument } from "@/lib/reports/pdf";

type Tab = "register" | "distribution" | "outcomes" | "durations" | "financial" | "workload" | "hearings" | "deadlines" | "inactive";

const TITLES: Record<Tab, string> = {
  register: "Case Register",
  distribution: "Matters by Status, Category & Court",
  outcomes: "Matter Outcomes",
  durations: "Average Duration",
  financial: "Financial Exposure",
  workload: "Lawyer Workload",
  hearings: "Upcoming Hearings",
  deadlines: "Overdue Deadlines",
  inactive: "Inactive Matters",
};

const CLAIMING_ROLES = new Set(["PLAINTIFF", "CLAIMANT", "APPLICANT", "PETITIONER", "APPELLANT"]);

type Column = { header: string; key: string; width: number };

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const tab = (url.searchParams.get("tab") ?? "register") as Tab;
  const filters = parseCaseFilters(Object.fromEntries(url.searchParams));
  const where = buildCaseWhere(filters, me.organizationId);
  const inactiveDays = Number(url.searchParams.get("inactiveDays")) > 0 ? Number(url.searchParams.get("inactiveDays")) : 30;

  const matters = await db.matter.findMany({
    where,
    orderBy: buildCaseOrderBy(filters),
    select: {
      id: true,
      reference: true,
      title: true,
      priority: true,
      status: true,
      ucaaRole: true,
      amountClaimed: true,
      amountAgainst: true,
      createdAt: true,
      lastActivityAt: true,
      closedAt: true,
      category: { select: { name: true } },
      matterType: { select: { name: true } },
      currentStage: { select: { name: true } },
      outcome: { select: { name: true } },
      closedBy: { select: { name: true } },
      forum: { select: { name: true } },
      assignments: { where: { removedAt: null }, select: { role: true, user: { select: { name: true } } } },
      stageMoves: { select: { enteredAt: true, exitedAt: true, stageTemplate: { select: { name: true } } } },
    },
  });
  if (filters.sort === "priority") {
    matters.sort((a, b) => (filters.dir === "asc" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]));
  }

  const matterIds = matters.map((m) => m.id);
  const now = new Date();
  const leadName = (m: (typeof matters)[number]) => m.assignments.find((a) => a.role === "LEAD")?.user.name ?? "";
  const valueOf = (m: (typeof matters)[number]) => (m.amountClaimed !== null ? formatUGX(m.amountClaimed) : "");

  let columns: Column[] = [];
  let rows: Record<string, string>[] = [];

  if (tab === "register") {
    columns = [
      { header: "Reference", key: "reference", width: 20 },
      { header: "Title", key: "title", width: 36 },
      { header: "Category", key: "category", width: 18 },
      { header: "Matter type", key: "matterType", width: 20 },
      { header: "Stage", key: "stage", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Value", key: "value", width: 16 },
      { header: "Lead", key: "lead", width: 20 },
      { header: "Opened", key: "opened", width: 14 },
      { header: "Last activity", key: "lastActivity", width: 14 },
    ];
    rows = matters.map((m) => ({
      reference: m.reference,
      title: m.title,
      category: m.category.name,
      matterType: m.matterType.name,
      stage: m.currentStage?.name ?? "",
      status: m.status.replace(/_/g, " "),
      priority: m.priority,
      value: valueOf(m),
      lead: leadName(m),
      opened: formatDate(m.createdAt),
      lastActivity: formatDate(m.lastActivityAt),
    }));
  } else if (tab === "distribution") {
    columns = [
      { header: "Status", key: "status", width: 16 },
      { header: "Category", key: "category", width: 20 },
      { header: "Court / forum", key: "forum", width: 22 },
      { header: "Reference", key: "reference", width: 20 },
      { header: "Title", key: "title", width: 36 },
    ];
    rows = matters.map((m) => ({ status: m.status.replace(/_/g, " "), category: m.category.name, forum: m.forum?.name ?? "", reference: m.reference, title: m.title }));
  } else if (tab === "outcomes") {
    columns = [
      { header: "Reference", key: "reference", width: 20 },
      { header: "Title", key: "title", width: 36 },
      { header: "Outcome", key: "outcome", width: 20 },
      { header: "Value", key: "value", width: 16 },
      { header: "Closed", key: "closed", width: 14 },
      { header: "Closed by", key: "closedBy", width: 20 },
    ];
    rows = matters
      .filter((m) => m.closedAt)
      .map((m) => ({ reference: m.reference, title: m.title, outcome: m.outcome?.name ?? "Not recorded", value: valueOf(m), closed: m.closedAt ? formatDate(m.closedAt) : "", closedBy: m.closedBy?.name ?? "" }));
  } else if (tab === "durations") {
    const closed = matters.filter((m) => m.closedAt);
    const byCategory = new Map<string, number[]>();
    for (const m of closed) {
      const days = (m.closedAt!.getTime() - m.createdAt.getTime()) / 86_400_000;
      byCategory.set(m.category.name, [...(byCategory.get(m.category.name) ?? []), days]);
    }
    const byStage = new Map<string, number[]>();
    for (const m of matters) {
      for (const s of m.stageMoves) {
        if (!s.exitedAt) continue;
        const days = (s.exitedAt.getTime() - s.enteredAt.getTime()) / 86_400_000;
        byStage.set(s.stageTemplate.name, [...(byStage.get(s.stageTemplate.name) ?? []), days]);
      }
    }
    columns = [
      { header: "Breakdown", key: "breakdown", width: 16 },
      { header: "Name", key: "name", width: 24 },
      { header: "Average days", key: "avgDays", width: 14 },
      { header: "Sample size", key: "sample", width: 12 },
    ];
    const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    rows = [
      ...[...byCategory.entries()].map(([name, xs]) => ({ breakdown: "By category", name, avgDays: String(avg(xs)), sample: String(xs.length) })),
      ...[...byStage.entries()].map(([name, xs]) => ({ breakdown: "By stage", name, avgDays: String(avg(xs)), sample: String(xs.length) })),
    ];
  } else if (tab === "financial") {
    let claimedFor = BigInt(0);
    let claimedAgainst = BigInt(0);
    let counterClaims = BigInt(0);
    for (const m of matters) {
      const value = m.amountClaimed ?? BigInt(0);
      if (CLAIMING_ROLES.has(m.ucaaRole)) claimedFor += value;
      else claimedAgainst += value;
      if (m.amountAgainst) counterClaims += m.amountAgainst;
    }
    columns = [
      { header: "Measure", key: "measure", width: 30 },
      { header: "Amount (UGX)", key: "amount", width: 20 },
    ];
    rows = [
      { measure: "Claimed for UCAA", amount: formatUGX(claimedFor) },
      { measure: "Claimed against UCAA", amount: formatUGX(claimedAgainst) },
      { measure: "Counter-claims", amount: formatUGX(counterClaims) },
    ];
  } else if (tab === "workload") {
    const lead = new Map<string, number>();
    const support = new Map<string, number>();
    const openLead = new Map<string, number>();
    for (const m of matters) {
      const isOpen = m.status === "OPEN" || m.status === "ON_HOLD" || m.status === "CLOSURE_REQUESTED";
      for (const a of m.assignments) {
        if (a.role === "LEAD") {
          lead.set(a.user.name, (lead.get(a.user.name) ?? 0) + 1);
          if (isOpen) openLead.set(a.user.name, (openLead.get(a.user.name) ?? 0) + 1);
        } else {
          support.set(a.user.name, (support.get(a.user.name) ?? 0) + 1);
        }
      }
    }
    const names = [...new Set([...lead.keys(), ...support.keys()])].sort();
    columns = [
      { header: "Lawyer", key: "lawyer", width: 24 },
      { header: "Leading (open)", key: "openLead", width: 16 },
      { header: "Leading (all matching filters)", key: "lead", width: 26 },
      { header: "Supporting", key: "support", width: 14 },
    ];
    rows = names.map((name) => ({ lawyer: name, openLead: String(openLead.get(name) ?? 0), lead: String(lead.get(name) ?? 0), support: String(support.get(name) ?? 0) }));
  } else if (tab === "hearings") {
    const hearings = await db.calendarEntry.findMany({
      where: { matterId: { in: matterIds }, kind: "HEARING", status: "OPEN", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { title: true, startsAt: true, courtroom: true, forum: { select: { name: true } }, assignee: { select: { name: true } }, matter: { select: { reference: true, title: true } } },
    });
    columns = [
      { header: "Matter", key: "matter", width: 36 },
      { header: "Hearing", key: "title", width: 24 },
      { header: "Date", key: "date", width: 18 },
      { header: "Court / courtroom", key: "court", width: 22 },
      { header: "Assigned to", key: "assignee", width: 20 },
    ];
    rows = hearings.map((h) => ({
      matter: `${h.matter?.title ?? ""} (${h.matter?.reference ?? ""})`,
      title: h.title,
      date: formatDate(h.startsAt, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }),
      court: [h.forum?.name, h.courtroom].filter(Boolean).join(" · "),
      assignee: h.assignee?.name ?? "",
    }));
  } else if (tab === "deadlines") {
    const [entries, tasks] = await Promise.all([
      db.calendarEntry.findMany({
        where: { matterId: { in: matterIds }, kind: "DEADLINE", status: "OPEN", startsAt: { lt: now } },
        select: { title: true, startsAt: true, assignee: { select: { name: true } }, matter: { select: { reference: true, title: true } } },
      }),
      db.task.findMany({
        where: { matterId: { in: matterIds }, status: "OPEN", doneAt: null, dueAt: { lt: now } },
        select: { title: true, dueAt: true, assignee: { select: { name: true } }, matter: { select: { reference: true, title: true } } },
      }),
    ]);
    columns = [
      { header: "Matter", key: "matter", width: 36 },
      { header: "Deadline", key: "title", width: 24 },
      { header: "Type", key: "type", width: 16 },
      { header: "Was due", key: "due", width: 16 },
      { header: "Assigned to", key: "assignee", width: 20 },
    ];
    rows = [
      ...entries.map((e) => ({ matter: `${e.matter?.title ?? ""} (${e.matter?.reference ?? ""})`, title: e.title, type: "Calendar deadline", due: formatDate(e.startsAt), assignee: e.assignee?.name ?? "" })),
      ...tasks.map((t) => ({ matter: `${t.matter.title} (${t.matter.reference})`, title: t.title, type: "Task", due: formatDate(t.dueAt), assignee: t.assignee?.name ?? "" })),
    ].sort((a, b) => a.due.localeCompare(b.due));
  } else {
    const cutoff = new Date(now.getTime() - inactiveDays * 86_400_000);
    const inactive = matters.filter((m) => (m.status === "OPEN" || m.status === "ON_HOLD") && m.lastActivityAt < cutoff);
    columns = [
      { header: "Reference", key: "reference", width: 20 },
      { header: "Title", key: "title", width: 36 },
      { header: "Status", key: "status", width: 16 },
      { header: "Lead", key: "lead", width: 20 },
      { header: "Last activity", key: "lastActivity", width: 14 },
    ];
    rows = inactive.map((m) => ({ reference: m.reference, title: m.title, status: m.status.replace(/_/g, " "), lead: leadName(m), lastActivity: formatDate(m.lastActivityAt) }));
  }

  await writeAudit({ userId: me.id, action: "report.export", entity: "Matter", after: { tab, format, count: rows.length } });

  if (format === "csv") {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key] ?? "")).join(","))];
    return new NextResponse(lines.join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="caa-legal-report-${tab}-${Date.now()}.csv"` },
    });
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(TITLES[tab]);
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="caa-legal-report-${tab}-${Date.now()}.xlsx"`,
      },
    });
  }

  // PDF — branded with the CAA logo, confidential footer, generated-by/timestamp (spec §5.10).
  const { doc, table } = createReportDocument({ title: TITLES[tab], generatedBy: me.name });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Landscape A4 content area is ~762pt wide — scale each column's xlsx width (chars) onto that.
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const pdfColumns = columns.map((c) => ({ label: c.header, width: Math.round((c.width / totalWidth) * 760) }));
  table(pdfColumns, rows.map((r) => columns.map((c) => r[c.key] || "—")));

  doc.end();
  const buffer = await done;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="caa-legal-report-${tab}-${Date.now()}.pdf"`,
    },
  });
}
