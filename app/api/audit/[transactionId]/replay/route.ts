import { jsonError, jsonOk } from "@/lib/http";
import { replay } from "@/lib/tax-service";

/**
 * GET /api/audit/{transactionId}/replay
 *
 * Recomputes the transaction twice: once against the rule versions snapshotted
 * onto the audit row at the time, once against today's rules. If a rate has
 * been changed since, the two differ — and the historical figure still matches
 * what was originally charged. Demonstrates rule versioning without asking the
 * reviewer to take the stored numbers on faith.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await params;
  const result = replay(transactionId);

  if (!result) {
    return jsonError(
      404,
      "AUDIT_RECORD_NOT_FOUND",
      `Nothing to replay for transaction ${transactionId}. Errored calculations are not replayable.`,
    );
  }

  return jsonOk({
    transaction_id: transactionId,
    historical_and_original_match: result.identical,
    original_tax_minor: result.original.taxAmountMinor,
    replayed_with_historical_rules_minor: result.replayedWithHistoricalRules.taxAmountMinor,
    replayed_with_current_rules_minor: result.replayedWithCurrentRules.taxAmountMinor,
    rules_changed_since:
      result.replayedWithHistoricalRules.taxAmountMinor !==
      result.replayedWithCurrentRules.taxAmountMinor,
    detail: result,
  });
}
