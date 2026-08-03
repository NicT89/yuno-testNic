import { jsonOk } from "@/lib/http";
import { getRuleHistory, listRules } from "@/lib/rules";

/**
 * GET /api/tax/rules?country=MX
 * GET /api/tax/rules?id=mx-iva-digital   (returns version history for one rule)
 *
 * Lists versioned tax rule definitions used by the calculator.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const country = searchParams.get("country")?.toUpperCase() ?? undefined;

  if (id) {
    const history = getRuleHistory(id);
    return jsonOk({
      ruleId: id,
      versions: history,
      count: history.length,
    });
  }

  const rules = listRules(country);
  return jsonOk({
    country: country ?? null,
    count: rules.length,
    rules,
  });
}
