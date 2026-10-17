import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { formatDate } from "@/lib/time";
import { buildContractWhere, parseContractFilters } from "@/app/(app)/contracts/filters";

const COLUMNS = [
  { header: "Reference", key: "reference", width: 20 },
  { header: "Title", key: "title", width: 36 },
  { header: "Counterparty", key: "counterparty", width: 26 },
  { header: "Type", key: "type", width: 20 },
  { header: "Department", key: "department", width: 18 },
  { header: "Received", key: "received", width: 14 },
  { header: "Legal review", key: "legalReview", width: 20 },
  { header: "Internal approval", key: "internalApproval", width: 22 },
  { header: "AG vetting", key: "agVetting", width: 24 },
  { header: "Amendments", key: "amendments", width: 20 },
  { header: "CAA execution", key: "caaExecution", width: 14 },
  { header: "Counterparty execution", key: "counterpartyExecution", width: 18 },
  { header: "Lifecycle stage", key: "stage", width: 20 },
  { header: "Expiry", key: "expiry", width: 14 },
  { header: "Responsible officer", key: "lead", width: 22 },
];

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const filters = parseContractFilters(Object.fromEntries(url.searchParams));

  const contracts = await db.contract.findMany({
    where: buildContractWhere(filters),
    orderBy: { lastActivityAt: "desc" },
    include: {
      category: true,
      currentStage: true,
      assignments: { where: { removedAt: null, role: "LEAD" }, include: { user: { select: { name: true } } } },
      legalReviewStatus: true,
      internalApprovalStatus: true,
      agVettingStatus: true,
      amendmentsStatus: true,
    },
  });

  await writeAudit({ userId: me.id, action: "contract.export", entity: "Contract", after: { format: "xlsx", count: contracts.length } });

  const rows = contracts.map((c) => ({
    reference: c.reference,
    title: c.title,
    counterparty: c.counterpartyName,
    type: c.category.name,
    department: c.originatingDepartment ?? "",
    received: c.dateOfReceipt ? formatDate(c.dateOfReceipt) : "",
    legalReview: c.legalReviewStatus?.label ?? "",
    internalApproval: c.internalApprovalStatus?.label ?? "",
    agVetting: c.agVettingStatus?.label ?? "",
    amendments: c.amendmentsStatus?.label ?? "",
    caaExecution: c.caaExecutionStatus === "SIGNED" ? "Signed" : "Pending",
    counterpartyExecution: c.counterpartyExecutionStatus === "SIGNED" ? "Signed" : "Pending",
    stage: c.currentStage?.name ?? "",
    expiry: c.expiryDate ? formatDate(c.expiryDate) : "",
    lead: c.assignments[0]?.user.name ?? "",
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Contracts");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(rows);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="caa-legal-contracts-${Date.now()}.xlsx"`,
    },
  });
}
