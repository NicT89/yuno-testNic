import { loadTransactions } from "@/lib/compliance";
import { jsonOk } from "@/lib/http";

/**
 * GET /api/transactions?country=MX
 *
 * Returns sample transactions used for development and compliance reporting.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country")?.toUpperCase() ?? undefined;

  const all = loadTransactions();
  const transactions = country
    ? all.filter((t) => t.country === country)
    : all;

  return jsonOk({
    country: country ?? null,
    count: transactions.length,
    transactions,
  });
}
