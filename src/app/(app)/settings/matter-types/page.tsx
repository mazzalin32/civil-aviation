import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { MatterTypeRowItem } from "./matter-type-row";
import { AddMatterType } from "./add-matter-type";

export const metadata = { title: "Matter types & lifecycles" };

function Table({ items }: { items: Awaited<ReturnType<typeof loadRows>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Name</th>
            <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Reference prefix</th>
            <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Closure policy</th>
            <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
            <th className="border-b border-border px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MatterTypeRowItem key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadRows(isSubProcess: boolean) {
  const rows = await db.matterType.findMany({
    where: { isSubProcess },
    orderBy: { order: "asc" },
    include: { _count: { select: { stages: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    referencePrefix: r.referencePrefix,
    closurePolicy: r.closurePolicy,
    isActive: r.isActive,
    stageCount: r._count.stages,
  }));
}

export default async function MatterTypesPage() {
  await requireRole("ADMIN");
  const [matterTypes, subProcesses] = await Promise.all([loadRows(false), loadRows(true)]);

  return (
    <>
      <PageHeader
        title="Matter types & lifecycles"
        description="How a matter runs — picks its lifecycle template. A matter also has a category (its subject); see the Categories tab."
      />
      <div className="grid gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Matter types</h2>
          <Card>
            <AddMatterType isSubProcess={false} />
            <Table items={matterTypes} />
          </Card>
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold">Sub-process templates</h2>
          <p className="mt-0 mb-3 text-xs text-text-muted">
            Run inside a matter with their own mini-lifecycle — an application, appeal, execution or taxation of costs.
          </p>
          <Card>
            <AddMatterType isSubProcess={true} />
            <Table items={subProcesses} />
          </Card>
        </section>
      </div>
    </>
  );
}
