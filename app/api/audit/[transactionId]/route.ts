import { getAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";

/**
 * GET /api/audit/{transactionId}
 *
 * Returns the complete, self-contained record of one calculation: the inputs as
 * submitted, the output, the ruleset version, the rule version ids that were
 * applied AND a full snapshot of those rules, plus a fingerprint of the inputs.
 * An auditor can verify the arithmetic from this row alone, without access to
 * the rule table and without trusting that the rules have not changed since.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await params;
  const record = getAudit(transactionId);

  if (!record) {
    return jsonError(
      404,
      "AUDIT_RECORD_NOT_FOUND",
      `No audit record for transaction ${transactionId}.`,
    );
  }

  return jsonOk(record);
}
