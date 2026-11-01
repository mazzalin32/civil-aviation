import { FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Downloads respect whatever tab + filters are currently applied — same query string, same rows. */
export function ReportExportButtons({ query }: { query: string }) {
  const sep = query ? "&" : "";
  return (
    <>
      <a href={`/api/reports/export?format=csv${sep}${query}`} className={buttonVariants({ variant: "secondary" })} title="Export CSV">
        <Sheet className="size-4" />
        <span className="hidden sm:inline">CSV</span>
      </a>
      <a href={`/api/reports/export?format=xlsx${sep}${query}`} className={buttonVariants({ variant: "secondary" })} title="Export Excel">
        <FileSpreadsheet className="size-4" />
        <span className="hidden sm:inline">Excel</span>
      </a>
      <a href={`/api/reports/export?format=pdf${sep}${query}`} className={buttonVariants({ variant: "secondary" })} title="Export PDF">
        <FileText className="size-4" />
        <span className="hidden sm:inline">PDF</span>
      </a>
    </>
  );
}
