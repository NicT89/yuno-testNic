/**
 * Tax calculation engine.
 *
 * Business rules encoded here:
 * 1. Amounts are integer minor units — round HALF-UP to the nearest unit.
 * 2. Exclusive mode: tax = round(net * rate); gross = net + tax.
 * 3. Inclusive mode: net = round(gross / (1 + rate)); tax = gross - net.
 *    (Deriving tax as residual avoids 1-cent drift between net + tax and gross.)
 * 4. Rate 0 (zero-rated or exempt) yields taxAmount = 0 with no rounding path.
 * 5. Missing rules throw — callers must not silently default to 0% (that would
 *    under-collect tax). The API layer maps this to HTTP 422.
 */

import { resolveTaxRule } from "./rules";
import type {
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxAmountMode,
} from "./types";

export class TaxRuleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleNotFoundError";
  }
}

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/** Banker's-avoiding half-up rounding for positive currency amounts. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Core calculator. Pure function over request + resolved rule — easy to unit test.
 */
export function calculateTax(request: TaxCalculationRequest): TaxCalculationResult {
  if (!Number.isInteger(request.amount) || request.amount < 0) {
    throw new InvalidAmountError(
      "`amount` must be a non-negative integer in minor currency units (cents).",
    );
  }

  const amountMode: TaxAmountMode = request.amountMode ?? "exclusive";
  const transactionDate = request.transactionDate ?? todayIsoDate();
  const currency = request.currency ?? "USD";
  const region = request.region ?? null;

  const rule = resolveTaxRule({
    country: request.country,
    region,
    category: request.category,
    transactionDate,
  });

  if (!rule) {
    throw new TaxRuleNotFoundError(
      `No tax rule found for country=${request.country} region=${region ?? "null"} ` +
        `category=${request.category} date=${transactionDate}`,
    );
  }

  const rate = rule.rate;
  const exempt = rate === 0;
  let netAmount: number;
  let taxAmount: number;
  let grossAmount: number;

  if (exempt) {
    // Zero-rated / exempt: pass amount through with zero tax.
    // For inclusive inputs we still treat the full amount as net (no embedded tax).
    netAmount = request.amount;
    taxAmount = 0;
    grossAmount = request.amount;
  } else if (amountMode === "exclusive") {
    netAmount = request.amount;
    taxAmount = roundHalfUp(netAmount * rate);
    grossAmount = netAmount + taxAmount;
  } else {
    // Inclusive: peel tax out of the gross figure.
    grossAmount = request.amount;
    netAmount = roundHalfUp(grossAmount / (1 + rate));
    taxAmount = grossAmount - netAmount;
  }

  return {
    country: request.country,
    region,
    category: request.category,
    currency,
    amountMode,
    netAmount,
    taxAmount,
    grossAmount,
    rate,
    taxName: rule.taxName,
    appliedRule: {
      id: rule.id,
      version: rule.version,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    },
    exempt,
  };
}
