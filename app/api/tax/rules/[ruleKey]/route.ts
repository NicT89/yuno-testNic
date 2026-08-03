import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import {
  closeRuleVersion,
  createRuleVersion,
  currentRulesetVersion,
  getCurrentRuleVersion,
} from "@/lib/rules-repo";
import { changeNote, toNewRuleInput, ValidationError } from "@/lib/validation";

/**
 * The verb surface here is CRUD because that is what an integrator expects.
 * The STORAGE underneath is append-only: PUT inserts a new version and stamps
 * `supersededAt` on the old one, DELETE closes the rule's validity window, and
 * nothing is ever updated in place or removed. See scripts/schema.sql.
 */

/** GET /api/tax/rules/{ruleKey} — the version currently in force. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruleKey: string }> },
) {
  const { ruleKey } = await params;
  const current = getCurrentRuleVersion(decodeURIComponent(ruleKey));

  if (!current) {
    return jsonError(404, "RULE_NOT_FOUND", `No rule with key ${decodeURIComponent(ruleKey)}.`);
  }

  return jsonOk({
    ruleset_version: currentRulesetVersion(),
    rule: current,
    versions_url: `/api/tax/rules/${encodeURIComponent(decodeURIComponent(ruleKey))}/versions`,
  });
}

/**
 * PUT /api/tax/rules/{ruleKey} — "update" the rule.
 *
 * Inserts vN+1 and supersedes vN. Both are returned so the change is
 * self-evident to the caller without a second request.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ ruleKey: string }> },
) {
  const { ruleKey } = await params;
  const key = decodeURIComponent(ruleKey);

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError(400, "INVALID_REQUEST", "Request body must be a JSON object.");
  }

  try {
    const existing = getCurrentRuleVersion(key);
    if (!existing) {
      return jsonError(
        404,
        "RULE_NOT_FOUND",
        `No rule with key ${key}. Use POST /api/tax/rules to create it.`,
      );
    }

    const outcome = createRuleVersion(
      toNewRuleInput(body, key),
      changeNote(body, `Rule updated via PUT /api/tax/rules/${key}`),
    );

    return jsonOk({
      message:
        "New version published and the previous one superseded. Calculations already " +
        "audited keep their original rate: nothing was updated in place.",
      ruleset_version: outcome.rulesetVersion,
      previous_version: outcome.previous,
      current_version: outcome.created,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    throw err;
  }
}

/**
 * DELETE /api/tax/rules/{ruleKey} — "delete" the rule.
 *
 * Closes the validity window at `?valid_to=` (default: now) by appending a
 * final version. The rule stops applying to transactions dated after that
 * instant; every earlier transaction still resolves exactly as it did.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ruleKey: string }> },
) {
  const { ruleKey } = await params;
  const key = decodeURIComponent(ruleKey);
  const { searchParams } = new URL(request.url);

  const validTo = searchParams.get("valid_to") ?? new Date().toISOString();
  if (Number.isNaN(new Date(validTo).getTime())) {
    return jsonError(400, "INVALID_REQUEST", "`valid_to` must be an ISO-8601 date.", {
      field: "valid_to",
    });
  }

  const outcome = closeRuleVersion(
    key,
    validTo,
    searchParams.get("change_note") ?? `Rule closed via DELETE /api/tax/rules/${key}`,
  );

  if (!outcome) {
    return jsonError(404, "RULE_NOT_FOUND", `No rule with key ${key}.`);
  }

  return jsonOk({
    message:
      `Rule closed with validTo=${validTo}. Nothing was deleted: transactions dated ` +
      "before that instant still resolve to this rule and report the rate they were charged.",
    ruleset_version: outcome.rulesetVersion,
    previous_version: outcome.previous,
    closing_version: outcome.created,
  });
}
