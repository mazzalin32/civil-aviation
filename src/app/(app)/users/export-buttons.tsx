import { FileSpreadsheet, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Downloads respect whatever filters are currently applied — same query string, same rows. */
export function ExportButtons({ query }: { query: string }) {
  return (
    <>
      <a href={`/api/users/export?format=xlsx${query}`} className={buttonVariants({ variant: "secondary" })} title="Export Excel">
        <FileSpreadsheet className="size-4" />
        <span className="hidden sm:inline">Excel</span>
      </a>
      <a href={`/api/users/export?format=pdf${query}`} className={buttonVariants({ variant: "secondary" })} title="Export PDF">
        <FileText className="size-4" />
        <span className="hidden sm:inline">PDF</span>
      </a>
    </>
  );
}
