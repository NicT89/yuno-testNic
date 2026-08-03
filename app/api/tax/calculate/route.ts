import { calculateTax, InvalidAmountError, TaxRuleNotFoundError } from "@/lib/calculator";
import { jsonError, jsonOk, parseAmount } from "@/lib/http";
import type { TaxAmountMode, TaxCategory, TaxCalculationRequest } from "@/lib/types";

const VALID_CATEGORIES: TaxCategory[] = [
  "standard",
  "reduced",
  "zero_rated",
  "exempt",
  "digital",
  "food",
  "clothing",
];

/**
 * POST /api/tax/calculate
 *
 * Body (JSON):
 * {
 *   "country": "MX",
 *   "region": null,          // optional
 *   "category": "standard",
 *   "amount": 100000,        // minor units (cents)
 *   "amountMode": "exclusive", // optional: exclusive | inclusive
 *   "transactionDate": "2025-03-15", // optional ISO date
 *   "currency": "MXN"        // optional
 * }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    return jsonError(400, "Request body must be a JSON object");
  }

  const input = body as Record<string, unknown>;

  if (typeof input.country !== "string" || input.country.length !== 2) {
    return jsonError(400, "`country` is required (ISO 3166-1 alpha-2, e.g. MX)");
  }

  if (
    typeof input.category !== "string" ||
    !VALID_CATEGORIES.includes(input.category as TaxCategory)
  ) {
    return jsonError(400, `\`category\` must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  const amount = parseAmount(input.amount);
  if (amount === null) {
    return jsonError(
      400,
      "`amount` must be a non-negative integer in minor currency units (cents)",
    );
  }

  const amountMode = (input.amountMode as TaxAmountMode | undefined) ?? "exclusive";
  if (amountMode !== "exclusive" && amountMode !== "inclusive") {
    return jsonError(400, "`amountMode` must be 'exclusive' or 'inclusive'");
  }

  const calcRequest: TaxCalculationRequest = {
    country: input.country.toUpperCase(),
    region:
      input.region === undefined || input.region === null
        ? null
        : String(input.region),
    category: input.category as TaxCategory,
    amount,
    amountMode,
    transactionDate:
      typeof input.transactionDate === "string" ? input.transactionDate : undefined,
    currency: typeof input.currency === "string" ? input.currency : undefined,
  };

  try {
    const result = calculateTax(calcRequest);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof TaxRuleNotFoundError) {
      return jsonError(422, err.message);
    }
    if (err instanceof InvalidAmountError) {
      return jsonError(400, err.message);
    }
    throw err;
  }
}
