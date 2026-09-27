import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lawyers");
  sheet.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Title", key: "title", width: 22 },
    { header: "Department", key: "department", width: 16 },
    { header: "Practising Cert No", key: "practisingCertNo", width: 20 },
    { header: "Cert Expiry", key: "certExpiry", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  // One clearly-marked example row — column headers can be renamed/reordered; import matches by name.
  sheet.addRow({
    name: "Example Lawyer (delete this row)",
    email: "example.lawyer@caa.go.ug",
    phone: "+256 772 000 000",
    title: "Legal Officer",
    department: "Legal",
    practisingCertNo: "PC/00000",
    certExpiry: "2027-01-31",
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF6B6760" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="caa-legal-lawyer-import-template.xlsx"',
    },
  });
}
