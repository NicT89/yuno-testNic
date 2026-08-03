/**
 * Application service. The only layer that mixes the pure domain with IO.
 * Route handlers call this; nothing here knows about HTTP.
 */

import { randomUUID } from 'node:crypto';
import { calculateTax, NoApplicableRuleError } from '../domain/calculator.ts';
import { resolveApplicableRules } from '../domain/ruleResolver.ts';
import { currencyExponent, formatMinor } from '../domain/money.ts';
import type { CalculationInput, CalculationResult, TaxRuleVersion } from '../domain/types.ts';
import { currentRulesetVersion, findCandidateRules } from '../db/rulesRepo.ts';
import { findByIdempotencyKey, getAudit, writeAudit, fingerprint } from '../db/auditRepo.ts';

export interface CalculateCommand {
  input: CalculationInput;
  rawRequest: unknown;
  transactionId?: string;
  idempotencyKey?: string | null;
  /** System-time instant used for rule selection. Defaults to now. */
  asOf?: string;
}

export interface CalculateOutcome {
  transactionId: string;
  createdAt: string;
  result: CalculationResult;
  replayed: boolean;
}

export function calculate(cmd: CalculateCommand): CalculateOutcome {
  // Idempotency-Key short-circuit: return the stored answer rather than
  // recomputing, so a retried checkout never double-books an audit entry.
  if (cmd.idempotencyKey) {
    const existing = findByIdempotencyKey(cmd.idempotencyKey);
    if (existing) {
      return {
        transactionId: existing.transactionId,
        createdAt: existing.createdAt,
        result: existing.output as unknown as CalculationResult,
        replayed: true,
      };
    }
  }

  const transactionId = cmd.transactionId ?? `txn_${randomUUID()}`;
  const asOf = cmd.asOf ?? new Date().toISOString();
  const rulesetVersion = currentRulesetVersion();
  const input = cmd.input;

  const candidates = findCandidateRules(input.countryCode, input.transactionDate, asOf);
  const applicable = resolveApplicableRules(candidates, {
    countryCode: input.countryCode,
    productCategory: input.productCategory,
    customerType: input.customerType,
    transactionDate: input.transactionDate,
    asOf,
  });

  try {
    const result = calculateTax(input, applicable, { rulesetVersion });
    writeAudit({
      transactionId,
      transactionDate: input.transactionDate,
      input,
      rawInput: cmd.rawRequest,
      result,
      error: null,
      rulesetVersion,
      appliedRules: applicable,
      idempotencyKey: cmd.idempotencyKey ?? null,
    });
    const stored = getAudit(transactionId)!;
    return { transactionId, createdAt: stored.createdAt, result, replayed: false };
  } catch (err) {
    // Failures are audited too. A compliance log that only records successes
    // hides exactly the transactions an auditor cares about.
    const code = err instanceof NoApplicableRuleError ? err.code : 'CALCULATION_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    writeAudit({
      transactionId,
      transactionDate: input.transactionDate,
      input,
      rawInput: cmd.rawRequest,
      result: null,
      error: { code, message },
      rulesetVersion,
      appliedRules: applicable,
      idempotencyKey: cmd.idempotencyKey ?? null,
    });
    throw err;
  }
}

/**
 * Replay a historical calculation exactly as it was originally computed by
 * pinning system time to the original `created_at`. Proves rule versioning
 * works without trusting the stored output.
 */
export function replay(transactionId: string): {
  original: CalculationResult;
  replayedWithHistoricalRules: CalculationResult;
  replayedWithCurrentRules: CalculationResult;
  identical: boolean;
} | null {
  const audit = getAudit(transactionId);
  if (!audit || audit.error) return null;

  const input: CalculationInput = {
    amountMinor: audit.input.amountMinor as number,
    discountMinor: audit.input.discountMinor as number,
    currency: audit.input.currency as string,
    countryCode: audit.input.countryCode as string,
    productCategory: audit.input.productCategory as string,
    customerType: audit.input.customerType as any,
    transactionDate: audit.transactionDate,
    priceIncludesTax: audit.input.priceIncludesTax as boolean,
  };

  const historical = calculateTax(input, audit.appliedRulesSnapshot, {
    rulesetVersion: audit.rulesetVersion,
  });

  const nowAsOf = new Date().toISOString();
  const currentRules = resolveApplicableRules(
    findCandidateRules(input.countryCode, input.transactionDate, nowAsOf),
    { ...input, asOf: nowAsOf },
  );
  const current = calculateTax(input, currentRules, {
    rulesetVersion: currentRulesetVersion(),
  });

  return {
    original: audit.output as unknown as CalculationResult,
    replayedWithHistoricalRules: historical,
    replayedWithCurrentRules: current,
    identical: historical.taxAmountMinor === (audit.output as any).taxAmountMinor,
  };
}

/** Decompose a tax-inclusive price into base + tax (stretch goal 5). */
export function decompose(input: CalculationInput): CalculationResult {
  const asOf = new Date().toISOString();
  const candidates = findCandidateRules(input.countryCode, input.transactionDate, asOf);
  const applicable = resolveApplicableRules(candidates, { ...input, asOf });
  return calculateTax({ ...input, priceIncludesTax: true }, applicable, {
    rulesetVersion: currentRulesetVersion(),
  });
}

/** Adds human-readable major-unit strings alongside every minor-unit integer. */
export function presentResult(result: CalculationResult) {
  const c = result.currency;
  return {
    ...result,
    amounts: {
      gross: formatMinor(result.grossAmountMinor, c),
      discount: formatMinor(result.discountMinor, c),
      base: formatMinor(result.baseAmountMinor, c),
      tax: formatMinor(result.taxAmountMinor, c),
      total: formatMinor(result.totalAmountMinor, c),
      currency: c,
      currencyExponent: currencyExponent(c),
    },
    effectiveRatePercent: `${(result.effectiveRateBps / 100).toFixed(2)}%`,
    taxLines: result.taxLines.map((l) => ({
      ...l,
      taxableAmount: formatMinor(l.taxableAmountMinor, c),
      taxAmount: formatMinor(l.taxAmountMinor, c),
    })),
  };
}

export { fingerprint };
