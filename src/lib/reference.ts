import "server-only";
import { db } from "./db";

type CounterClient = Pick<typeof db, "referenceCounter">;

function format(prefix: string, year: number, n: number) {
  return `UCAA/${prefix}/${year}/${String(n).padStart(4, "0")}`;
}

/**
 * Atomically allocates the next case reference for a prefix this year, e.g. "LIT" →
 * "UCAA/LIT/2026/0042" (spec §5.5 step 3, pattern set in Settings via MatterType.referencePrefix).
 * Call inside the same $transaction as the Matter creation so a rollback also frees the number.
 */
export async function generateReference(prefix: string, client: CounterClient = db): Promise<string> {
  const year = new Date().getUTCFullYear();
  try {
    const row = await client.referenceCounter.update({
      where: { prefix_year: { prefix, year } },
      data: { next: { increment: 1 } },
      select: { next: true },
    });
    return format(prefix, year, row.next - 1);
  } catch {
    try {
      await client.referenceCounter.create({ data: { prefix, year, next: 2 } });
      return format(prefix, year, 1);
    } catch {
      // Lost the race to another concurrent first-of-the-year create — just increment now.
      const row = await client.referenceCounter.update({
        where: { prefix_year: { prefix, year } },
        data: { next: { increment: 1 } },
        select: { next: true },
      });
      return format(prefix, year, row.next - 1);
    }
  }
}
