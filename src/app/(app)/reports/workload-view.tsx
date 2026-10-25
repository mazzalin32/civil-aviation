import { Card } from "@/components/ui/card";
import { BarList } from "../contracts/bar-list";

export type WorkloadMatterRow = {
  status: string;
  assignments: { role: "LEAD" | "SUPPORT"; userName: string }[];
};

export function WorkloadView({ rows }: { rows: WorkloadMatterRow[] }) {
  const lead = new Map<string, number>();
  const support = new Map<string, number>();
  const openLead = new Map<string, number>();

  for (const r of rows) {
    const isOpen = r.status === "OPEN" || r.status === "ON_HOLD" || r.status === "CLOSURE_REQUESTED";
    for (const a of r.assignments) {
      if (a.role === "LEAD") {
        lead.set(a.userName, (lead.get(a.userName) ?? 0) + 1);
        if (isOpen) openLead.set(a.userName, (openLead.get(a.userName) ?? 0) + 1);
      } else {
        support.set(a.userName, (support.get(a.userName) ?? 0) + 1);
      }
    }
  }

  const names = [...new Set([...lead.keys(), ...support.keys()])].sort();
  const chartRows = names.map((name) => ({ label: name, count: openLead.get(name) ?? 0 })).sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4">
      <BarList title="Open matters led, by lawyer" rows={chartRows} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-text-muted">
                <th className="px-4 py-3 font-medium">Lawyer</th>
                <th className="px-4 py-3 font-medium">Leading (open)</th>
                <th className="px-4 py-3 font-medium">Leading (all matching filters)</th>
                <th className="px-4 py-3 font-medium">Supporting</th>
              </tr>
            </thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3 tabular-nums">{openLead.get(name) ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums">{lead.get(name) ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums">{support.get(name) ?? 0}</td>
                </tr>
              ))}
              {names.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-text-muted">
                    No assigned matters match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
