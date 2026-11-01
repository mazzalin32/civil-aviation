import { Card } from "@/components/ui/card";
import { formatUGX } from "@/lib/time";
import { BarList } from "../contracts/bar-list";

// UCAA is the one bringing the claim on these roles; the rest are roles where UCAA is being
// claimed against (defending). amountAgainst is a separate counter-claim value within the
// same matter (e.g. the other side's counter-suit), tracked regardless of which side UCAA is on.
const CLAIMING_ROLES = new Set(["PLAINTIFF", "CLAIMANT", "APPLICANT", "PETITIONER", "APPELLANT"]);

export type FinancialRow = { categoryName: string; ucaaRole: string; amountClaimed: bigint | null; amountAgainst: bigint | null };

export function FinancialView({ rows }: { rows: FinancialRow[] }) {
  let claimedFor = BigInt(0);
  let claimedAgainst = BigInt(0);
  let counterClaims = BigInt(0);
  const byCategory = new Map<string, bigint>();

  for (const r of rows) {
    const value = r.amountClaimed ?? BigInt(0);
    if (CLAIMING_ROLES.has(r.ucaaRole)) claimedFor += value;
    else claimedAgainst += value;
    if (r.amountAgainst) counterClaims += r.amountAgainst;
    if (r.amountClaimed) byCategory.set(r.categoryName, (byCategory.get(r.categoryName) ?? BigInt(0)) + r.amountClaimed);
  }

  const categoryRows = [...byCategory.entries()]
    .map(([label, total]) => ({ label, count: Number(total), displayValue: formatUGX(total) }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="m-0 text-[12px] text-text-muted">Claimed for UCAA</p>
          <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-success">{formatUGX(claimedFor)}</p>
          <p className="m-0 mt-1 text-[11px] text-text-muted">Matters where UCAA is the claiming party</p>
        </Card>
        <Card className="p-5">
          <p className="m-0 text-[12px] text-text-muted">Claimed against UCAA</p>
          <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-danger">{formatUGX(claimedAgainst)}</p>
          <p className="m-0 mt-1 text-[11px] text-text-muted">Matters where UCAA is defending or responding</p>
        </Card>
        <Card className="p-5">
          <p className="m-0 text-[12px] text-text-muted">Counter-claims</p>
          <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-warning">{formatUGX(counterClaims)}</p>
          <p className="m-0 mt-1 text-[11px] text-text-muted">Recorded on the opposing side within a matter</p>
        </Card>
      </div>

      <BarList title="Claim value by category (UGX)" rows={categoryRows} />
    </div>
  );
}
