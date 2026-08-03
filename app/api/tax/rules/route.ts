import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import {
  createRuleVersion,
  currentRulesetVersion,
  listRules,
  listVersionsOfRule,
} from "@/lib/rules-repo";
import { changeNote, parseCountryParam, toNewRuleInput, ValidationError } from "@/lib/validation";

/**
 * GET /api/tax/rules
 *   ?country=BR                      filter by country
 *   &on_date=2026-03-01              VALID TIME: rules that were law on this date
 *   &as_of=2026-01-01T00:00:00.000Z  SYSTEM TIME: what we believed at this instant
 *   &include_superseded=true         show the full history, replaced versions and all
 *   ?rule_key=BR:ELECTRONICS:ICMS    full lineage of one rule
 *
 * The two date filters are independent on purpose: `on_date` answers "what was
 * the law?", `as_of` answers "what did we believe?".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruleKey = searchParams.get("rule_key");

  try {
    if (ruleKey) {
      const versions = listVersionsOfRule(ruleKey);
      if (versions.length === 0) {
        return jsonError(404, "RULE_NOT_FOUND", `No rule with key ${ruleKey}.`);
      }
      return jsonOk({
        rule_key: ruleKey,
        ruleset_version: currentRulesetVersion(),
        count: versions.length,
        versions,
      });
    }

    const rules = listRules({
      countryCode: parseCountryParam(searchParams.get("country")),
      onDate: searchParams.get("on_date") ?? undefined,
      asOf: searchParams.get("as_of") ?? undefined,
      includeSuperseded: searchParams.get("include_superseded") === "true",
    });

    return jsonOk({
      ruleset_version: currentRulesetVersion(),
      count: rules.length,
      rules,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    throw err;
  }
}

/**
 * POST /api/tax/rules
 *
 * Publishes a NEW VERSION of a rule (v1 if the key is new). Never mutates an
 * existing one, so every calculation already recorded keeps resolving to the
 * rule that was in force when it ran. Bumps the ruleset version.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) {
    return jsonError(400, "INVALID_REQUEST", "Request body must be a JSON object.");
  }

  try {
    const outcome = createRuleVersion(
      toNewRuleInput(body),
      changeNote(body, "Rule published via POST /api/tax/rules"),
    );

    return jsonOk(
      {
        message:
          "New rule version published. Existing audit records are unaffected and still " +
          "resolve to the version that was in force when they were calculated.",
        ruleset_version: outcome.rulesetVersion,
        previous_version: outcome.previous,
        rule: outcome.created,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    throw err;
  }
}
