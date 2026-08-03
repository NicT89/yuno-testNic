import { jsonError, jsonOk } from "@/lib/http";
import { currentRulesetVersion, listVersionsOfRule } from "@/lib/rules-repo";

/**
 * GET /api/tax/rules/{ruleKey}/versions
 *
 * The full lineage of one rule, oldest version first. `supersededAt` on a row
 * is the moment we stopped believing it; `validFrom`/`validTo` is when it was
 * the law. Reading the two columns side by side is the clearest demonstration
 * that the store is bitemporal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruleKey: string }> },
) {
  const { ruleKey } = await params;
  const key = decodeURIComponent(ruleKey);
  const versions = listVersionsOfRule(key);

  if (versions.length === 0) {
    return jsonError(404, "RULE_NOT_FOUND", `No rule with key ${key}.`);
  }

  return jsonOk({
    rule_key: key,
    ruleset_version: currentRulesetVersion(),
    count: versions.length,
    versions,
  });
}
