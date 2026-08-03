import { NoApplicableRuleError } from "@/lib/calculator";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { calculate, presentResult, ReplayedFailureError } from "@/lib/tax-service";
import { optionalTransactionId, toCalculationInput, ValidationError } from "@/lib/validation";

/**
 * POST /api/tax/calculate
 *
 * Body (snake_case at the boundary):
 * {
 *   "country_code": "BR",              // BR | CO | AR | CL | PE
 *   "product_category": "electronics",
 *   "amount": 100.00,                  // major units, or `amount_minor` (integer)
 *   "discount": 0,                     // optional, or `discount_minor`
 *   "customer_type": "individual",     // optional: individual | business
 *   "currency": "BRL",                 // optional, defaults per country
 *   "transaction_date": "2026-03-15T12:00:00.000Z",  // optional, defaults to now
 *   "price_includes_tax": false,       // optional
 *   "transaction_id": "txn_..."        // optional, otherwise generated
 * }
 *
 * Honours an optional `Idempotency-Key` header the way a payments API would:
 * a retried checkout returns the stored answer instead of writing a second
 * audit row.
 *
 * Every request — including the ones that fail — writes exactly one audit row.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) {
    return jsonError(400, "INVALID_REQUEST", "Request body must be a JSON object.");
  }

  try {
    const input = toCalculationInput(body);
    const outcome = calculate({
      input,
      rawRequest: body,
      transactionId: optionalTransactionId(body),
      idempotencyKey: request.headers.get("Idempotency-Key"),
    });

    return jsonOk({
      transaction_id: outcome.transactionId,
      calculated_at: outcome.createdAt,
      replayed_from_idempotency_key: outcome.replayed,
      ...presentResult(outcome.result),
      audit_url: `/api/audit/${outcome.transactionId}`,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    if (err instanceof NoApplicableRuleError) {
      // 422, never a silent 0%: an unpriced tax is a compliance risk, and the
      // attempt has already been recorded in the audit trail.
      return jsonError(422, err.code, err.message, err.details);
    }
    if (err instanceof ReplayedFailureError) {
      // A retry of a request that failed the first time gets the same answer it
      // got originally, rather than a fresh 500.
      const status = err.code === "NO_APPLICABLE_RULE" ? 422 : 500;
      return jsonError(status, err.code, err.message, { replayed: true });
    }
    throw err;
  }
}
