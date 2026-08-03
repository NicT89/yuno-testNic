import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsonOk } from "@/lib/http";

/**
 * GET /api/transactions?country=BR
 *
 * The seed fixtures, served straight from `data/transactions.json`. These are
 * the inputs replayed into the audit trail by `npm run db:seed`; the results of
 * that replay live at /api/audit.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country")?.toUpperCase();

  const fixtures = JSON.parse(
    readFileSync(join(process.cwd(), "data", "transactions.json"), "utf-8"),
  ) as Array<Record<string, unknown>>;

  const transactions = country
    ? fixtures.filter((t) => t.countryCode === country)
    : fixtures;

  return jsonOk({
    country: country ?? null,
    count: transactions.length,
    transactions,
  });
}
