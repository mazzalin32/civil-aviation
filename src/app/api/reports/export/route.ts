import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { formatDate, formatUGX } from "@/lib/time";
import { buildCaseOrderBy, buildCaseWhere, parseCaseFilters, PRIORITY_RANK } from "@/app/(app)/cases/filters";
import { createReportDocument } from "@/lib/reports/pdf";

type Tab = "register" | "outcomes" | "workload";

const TITLES: Record<Tab, string> = {
  register: "Case Register",
  outcomes: "Matter Outcomes",
  workload: "Lawyer Workload",
};

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const tab = (url.searchParams.get("tab") ?? "register") as Tab;
  const filters = parseCaseFilters(Object.fromEntries(url.searchParams));
  const where = buildCaseWhere(filters, me.organizationId);

  const matters = await db.matter.findMany({
    where,
    orderBy: buildCaseOrderBy(filters),
    select: {
      id: true,
      reference: true,
      title: true,
      priority: true,
      status: true,
      amountClaimed: true,
      createdAt: true,
      lastActivityAt: true,
      closedAt: true,
      category: { select: { name: true } },
      matterType: { select: { name: true } },
      currentStage: { select: { name: true } },
      outcome: { select: { name: true } },
      closedBy: { select: { name: true } },
      assignments: { where: { removedAt: null }, select: { role: true, user: { select: { name: true } } } },
    },
  });
  if (filters.sort === "priority") {
    matters.sort((a, b) => (filters.dir === "asc" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]));
  }

  await writeAudit({ userId: me.id, action: "report.export", entity: "Matter", after: { tab, format, count: matters.length } });

  const leadName = (m: (typeof matters)[number]) => m.assignments.find((a) => a.role === "LEAD")?.user.name ?? "";
  const valueOf = (m: (typeof matters)[number]) => (m.amountClaimed !== null ? formatUGX(m.amountClaimed) : "");

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();

    if (tab === "register") {
      const sheet = workbook.addWorksheet("Case Register");
      sheet.columns = [
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
      sheet.getRow(1).font = { bold: true };
      sheet.addRows(
        matters.map((m) => ({
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
        })),
      );
    } else if (tab === "outcomes") {
      const sheet = workbook.addWorksheet("Outcomes");
      sheet.columns = [
        { header: "Reference", key: "reference", width: 20 },
        { header: "Title", key: "title", width: 36 },
        { header: "Outcome", key: "outcome", width: 20 },
        { header: "Value", key: "value", width: 16 },
        { header: "Closed", key: "closed", width: 14 },
        { header: "Closed by", key: "closedBy", width: 20 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.addRows(
        matters
          .filter((m) => m.closedAt)
          .map((m) => ({
            reference: m.reference,
            title: m.title,
            outcome: m.outcome?.name ?? "Not recorded",
            value: valueOf(m),
            closed: m.closedAt ? formatDate(m.closedAt) : "",
            closedBy: m.closedBy?.name ?? "",
          })),
      );
    } else {
      const sheet = workbook.addWorksheet("Lawyer Workload");
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
      sheet.columns = [
        { header: "Lawyer", key: "lawyer", width: 24 },
        { header: "Leading (open)", key: "openLead", width: 16 },
        { header: "Leading (all matching filters)", key: "lead", width: 26 },
        { header: "Supporting", key: "support", width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.addRows(names.map((name) => ({ lawyer: name, openLead: openLead.get(name) ?? 0, lead: lead.get(name) ?? 0, support: support.get(name) ?? 0 })));
    }

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

  if (tab === "register") {
    table(
      [
        { label: "Reference", width: 95 },
        { label: "Title", width: 190 },
        { label: "Category", width: 85 },
        { label: "Stage", width: 95 },
        { label: "Status", width: 85 },
        { label: "Priority", width: 55 },
        { label: "Value", width: 90 },
        { label: "Lead", width: 95 },
        { label: "Opened", width: 71 },
      ],
      matters.map((m) => [m.reference, m.title, m.category.name, m.currentStage?.name ?? "—", m.status.replace(/_/g, " "), m.priority, valueOf(m) || "—", leadName(m) || "—", formatDate(m.createdAt)]),
    );
  } else if (tab === "outcomes") {
    const closed = matters.filter((m) => m.closedAt);
    table(
      [
        { label: "Reference", width: 110 },
        { label: "Title", width: 260 },
        { label: "Outcome", width: 150 },
        { label: "Value", width: 120 },
        { label: "Closed", width: 90 },
        { label: "Closed by", width: 130 },
      ],
      closed.map((m) => [m.reference, m.title, m.outcome?.name ?? "Not recorded", valueOf(m) || "—", m.closedAt ? formatDate(m.closedAt) : "—", m.closedBy?.name ?? "—"]),
    );
  } else {
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
    table(
      [
        { label: "Lawyer", width: 220 },
        { label: "Leading (open)", width: 150 },
        { label: "Leading (filtered)", width: 150 },
        { label: "Supporting", width: 150 },
      ],
      names.map((name) => [name, String(openLead.get(name) ?? 0), String(lead.get(name) ?? 0), String(support.get(name) ?? 0)]),
    );
  }

  doc.end();
  const buffer = await done;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="caa-legal-report-${tab}-${Date.now()}.pdf"`,
    },
  });
}
