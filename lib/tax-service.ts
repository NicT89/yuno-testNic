/**
 * Application service: the only layer that mixes the pure domain with IO.
 * Route handlers call this; nothing here knows about HTTP.
 *
 * app/api/** -> lib/tax-service -> lib/{rules-repo,audit} -> lib/{calculator,rules,money}
 */

import { randomUUID } from "node:crypto";
import { calculateTax, NoApplicableRuleError } from "./calculator";
import { resolveApplicableRules } from "./rules";
import { currencyExponent, formatMinor } from "./money";
import type { CalculationInput, CalculationResult } from "./types";
import { countryRoundingMode, currentRulesetVersion, findCandidateRules } from "./rules-repo";
import { findByIdempotencyKey, getAudit, writeAudit, type AuditRecord } from "./audit";

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

/**
 * Raised when a retry replays a calculation that originally failed. Carries the
 * stored error code so the caller gets the same status it got the first time,
 * rather than a 500 on the second attempt.
 */
export class ReplayedFailureError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ReplayedFailureError";
  }
}

/** Turn a stored audit row back into the answer the caller got the first time. */
function replayStored(existing: AuditRecord): CalculateOutcome {
  if (existing.error) {
    // The original attempt was rejected; a retry must be rejected identically.
    throw new ReplayedFailureError(existing.error.code, existing.error.message);
  }
  return {
    transactionId: existing.transactionId,
    createdAt: existing.createdAt,
    result: existing.output as unknown as CalculationResult,
    replayed: true,
  };
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export function calculate(cmd: CalculateCommand): CalculateOutcome {
  // Idempotency short-circuit, on either key the caller can supply: return the
  // stored answer rather than recomputing, so a retried checkout never
  // double-books an audit entry.
  //
  // Anonymous calls (no supplied id, no header) always generate a fresh id and
  // append a fresh row — the compliance log must never drop an event.
  if (cmd.idempotencyKey) {
    const existing = findByIdempotencyKey(cmd.idempotencyKey);
    if (existing) return replayStored(existing);
  }
  if (cmd.transactionId) {
    const existing = getAudit(cmd.transactionId);
    if (existing) return replayStored(existing);
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

  const audit = (
    result: CalculationResult | null,
    error: { code: string; message: string } | null,
  ) =>
    writeAudit({
      transactionId,
      transactionDate: input.transactionDate,
      input,
      rawInput: cmd.rawRequest,
      result,
      error,
      rulesetVersion,
      appliedRules: applicable,
      idempotencyKey: cmd.idempotencyKey ?? null,
    });

  // Rounding policy is per country (countries.rounding_mode), not a constant:
  // a jurisdiction that mandates banker's rounding is a data change, not a code change.
  const roundingMode = countryRoundingMode(input.countryCode);

  let result: CalculationResult;
  try {
    result = calculateTax(input, applicable, { rulesetVersion, roundingMode });
  } catch (err) {
    // Failures are audited too. A compliance log that only records successes
    // hides exactly the transactions an auditor cares about.
    const code = err instanceof NoApplicableRuleError ? err.code : "CALCULATION_ERROR";
    const message = err instanceof Error ? err.message : String(err);
    try {
      audit(null, { code, message });
    } catch (writeErr) {
      // Lost a race against a concurrent retry of the same transaction id: the
      // other writer already recorded this failure. Replay it, do not 500.
      const existing = isUniqueConstraintViolation(writeErr)
        ? getAudit(transactionId)
        : null;
      if (existing) return replayStored(existing);
      throw writeErr;
    }
    throw err;
  }

  try {
    const stored = audit(result, null);
    return { transactionId, createdAt: stored.createdAt, result, replayed: false };
  } catch (err) {
    // Same race, success path: two clients retrying concurrently must not 500.
    const existing = isUniqueConstraintViolation(err) ? getAudit(transactionId) : null;
    if (existing) return replayStored(existing);
    throw err;
  }
}

export interface ReplayOutcome {
  original: CalculationResult;
  replayedWithHistoricalRules: CalculationResult;
  replayedWithCurrentRules: CalculationResult;
  identical: boolean;
}

/**
 * Replay a historical calculation exactly as it was originally computed, by
 * recomputing against the rule versions snapshotted onto the audit row, then
 * again against today's rules. Proves rule versioning works without asking
 * anyone to trust the stored numbers.
 */
export function replay(transactionId: string): ReplayOutcome | null {
  const audit = getAudit(transactionId);
  if (!audit || audit.error) return null;

  const input: CalculationInput = {
    amountMinor: audit.input.amountMinor as number,
    discountMinor: audit.input.discountMinor as number,
    currency: audit.input.currency as string,
    countryCode: audit.input.countryCode as string,
    productCategory: audit.input.productCategory as string,
    customerType: audit.input.customerType as CalculationInput["customerType"],
    transactionDate: audit.transactionDate,
    priceIncludesTax: audit.input.priceIncludesTax as boolean,
  };

  const roundingMode = countryRoundingMode(input.countryCode);
  const historical = calculateTax(input, audit.appliedRulesSnapshot, {
    rulesetVersion: audit.rulesetVersion,
    roundingMode,
  });

  const nowAsOf = new Date().toISOString();
  const currentRules = resolveApplicableRules(
    findCandidateRules(input.countryCode, input.transactionDate, nowAsOf),
    { ...input, asOf: nowAsOf },
  );
  const current = calculateTax(input, currentRules, {
    rulesetVersion: currentRulesetVersion(),
    roundingMode,
  });

  const original = audit.output as unknown as CalculationResult;
  return {
    original,
    replayedWithHistoricalRules: historical,
    replayedWithCurrentRules: current,
    identical: historical.taxAmountMinor === original.taxAmountMinor,
  };
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
