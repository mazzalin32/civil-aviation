import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { formatDate } from "@/lib/time";
import { ImportWizard } from "./import-wizard";
import { RollbackButton } from "./rollback-button";

export const metadata = { title: "Import lawyers" };

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function ImportUsersPage() {
  await requireRole("ADMIN");
  // A Server Component render is already tied to one request — "now" is legitimately
  // request-time here, not a hook needing to be stable across client re-renders.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const batches = await db.importBatch.findMany({
    where: { kind: "USERS" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <>
      <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> Users
      </Link>
      <PageHeader title="Import lawyers" description="Bring in a whole roster from Excel at once — each lawyer still gets the normal invite email." />
      <div className="grid gap-8">
        <ImportWizard />

        {batches.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recent imports</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">When</th>
                      <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">By</th>
                      <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Result</th>
                      <th className="border-b border-border px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => {
                      const withinWindow = now - b.createdAt.getTime() <= ROLLBACK_WINDOW_MS;
                      return (
                        <tr key={b.id}>
                          <td className="border-b border-border px-4 py-2.5 text-text-muted">{formatDate(b.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                          <td className="border-b border-border px-4 py-2.5 text-text-muted">{b.createdBy.name}</td>
                          <td className="border-b border-border px-4 py-2.5">
                            <Badge tone="success">{b.rowsOk} added</Badge>
                            {b.rowsFailed > 0 && (
                              <Badge tone="danger" className="ml-1.5">
                                {b.rowsFailed} skipped
                              </Badge>
                            )}
                          </td>
                          <td className="border-b border-border px-4 py-2.5 text-right">
                            {b.rolledBackAt ? (
                              <Badge tone="neutral">Rolled back</Badge>
                            ) : withinWindow && b.rowsOk > 0 ? (
                              <RollbackButton batchId={b.id} createdCount={b.rowsOk} />
                            ) : (
                              <span className="text-xs text-text-muted">Window closed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}
