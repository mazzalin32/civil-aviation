import ExcelJS from "exceljs";

/**
 * Flexible column matching: the Admin's spreadsheet doesn't have to use our exact
 * header wording or column order — we match by a list of common alternatives.
 */
const ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "lawyer name", "lawyer", "employee name"],
  email: ["email", "email address", "e-mail", "mail", "work email"],
  phone: ["phone", "phone number", "mobile", "mobile number", "contact", "tel", "telephone"],
  title: ["title", "position", "job title", "designation", "role title"],
  department: ["department", "dept", "unit", "division"],
  practisingCertNo: [
    "practising cert no",
    "practicing cert no",
    "cert no",
    "certificate no",
    "certificate number",
    "bar number",
    "practising certificate no",
    "practising certificate number",
    "pc no",
  ],
  certExpiry: ["cert expiry", "certificate expiry", "expiry date", "expiry", "cert expiry date", "certificate expiry date"],
};

export const FIELD_KEYS = Object.keys(ALIASES) as FieldKey[];
export type FieldKey = keyof typeof ALIASES;
export type ColumnMapping = Partial<Record<FieldKey, number>>; // field -> column index (0-based)

function normalize(header: string) {
  return header
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-guess mapping from the file's actual header row. The Admin can still adjust it. */
export function detectColumns(headerRow: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headerRow.forEach((raw, index) => {
    const normalized = normalize(raw ?? "");
    for (const field of FIELD_KEYS) {
      if (mapping[field] !== undefined) continue;
      if (ALIASES[field].some((alias) => normalize(alias) === normalized)) mapping[field] = index;
    }
  });
  return mapping;
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
  return String(v).trim();
}

/** Reads the file once into a plain text grid — nothing DB-dependent here, so it's safe to hand to the client for a remap round-trip without re-uploading. */
export async function parseWorkbookToGrid(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The file has no sheets.");

  let headerRow: string[] = [];
  const grid: string[][] = [];
  sheet.eachRow((row, rowNumber) => {
    const width = Math.max(row.cellCount, headerRow.length);
    const cells = Array.from({ length: width }, (_, i) => cellText(row.getCell(i + 1)));
    if (rowNumber === 1) headerRow = cells;
    else if (cells.some((c) => c !== "")) grid.push(cells); // skip fully-blank rows
  });

  return { headerRow, grid };
}

export type ParsedRow = {
  row: number; // 1-based position within the parsed rows, for messages
  name: string;
  email: string;
  phone: string;
  title: string;
  department: string;
  practisingCertNo: string;
  certExpiry: string; // ISO date or ""
  errors: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toIsoDate(text: string): { iso: string; error?: string } {
  if (!text) return { iso: "" };
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return { iso: "", error: "unreadable expiry date" };
  return { iso: d.toISOString().slice(0, 10) };
}

/** Pure — applies a mapping to the already-parsed grid and validates. Safe to re-run whenever the Admin adjusts the mapping. */
export function validateMappedRows(grid: string[][], mapping: ColumnMapping, existingEmails: Set<string>): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const seenInFile = new Set<string>();

  grid.forEach((cells, i) => {
    const get = (field: FieldKey) => {
      const col = mapping[field];
      return col === undefined ? "" : (cells[col] ?? "");
    };

    const name = get("name");
    const email = get("email").toLowerCase();
    const { iso: certExpiry, error: dateError } = toIsoDate(get("certExpiry"));

    const errors: string[] = [];
    if (!name) errors.push("missing name");
    if (!email) errors.push("missing email");
    else if (!EMAIL_RE.test(email)) errors.push("invalid email format");
    else if (existingEmails.has(email)) errors.push("email already has an account");
    else if (seenInFile.has(email)) errors.push("duplicate email in this file");
    if (dateError) errors.push(dateError);

    seenInFile.add(email);
    rows.push({
      row: i + 1,
      name,
      email,
      phone: get("phone"),
      title: get("title"),
      department: get("department"),
      practisingCertNo: get("practisingCertNo"),
      certExpiry,
      errors,
    });
  });

  return rows;
}
