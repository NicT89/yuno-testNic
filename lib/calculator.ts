/**
 * The tax calculation engine. PURE: no database, no clock, no network.
 * Given (inputs, rules) it always returns the same result, which is what makes
 * the service idempotent and every historical calculation replayable.
 */

import {
  applyRateBps,
  bpsToPercent,
  currencyExponent,
  divideRound,
  formatMinor,
} from "./money";
import type { RoundingMode } from "./money";
import type {
  CalculationInput,
  CalculationResult,
  TaxLine,
  TaxRuleVersion,
} from "./types";
import { ENGINE_VERSION } from "./types";

export interface CalculateOptions {
  rulesetVersion: number;
  roundingMode?: RoundingMode;
}

/** Treatments that resolve to zero collected tax, each for a different reason. */
const NON_COLLECTING: Record<string, string> = {
  exempt: "Category is exempt from this tax.",
  zero_rated: "Zero-rated: in scope for reporting but taxed at 0%.",
  reverse_charge:
    "Reverse charge: liability shifts to the registered business buyer, seller collects nothing.",
};

export class NoApplicableRuleError extends Error {
  readonly code = "NO_APPLICABLE_RULE";
  readonly details: Record<string, unknown>;
  constructor(input: CalculationInput) {
    super(
      `No tax rule is on file for ${input.countryCode}/${input.productCategory}/${input.customerType} ` +
        `effective ${input.transactionDate}. Refusing to assume 0%: an unpriced tax is a compliance risk.`,
    );
    this.name = "NoApplicableRuleError";
    this.details = {
      countryCode: input.countryCode,
      productCategory: input.productCategory,
      customerType: input.customerType,
      transactionDate: input.transactionDate,
    };
  }
}

export function calculateTax(
  input: CalculationInput,
  rules: TaxRuleVersion[],
  opts: CalculateOptions,
): CalculationResult {
  const rounding = opts.roundingMode ?? "HALF_UP";
  const exponent = currencyExponent(input.currency);
  const steps: string[] = [];
  const notes: string[] = [];
  const taxLines: TaxLine[] = [];

  // -------------------------------------------------------------------------
  // Step 1. Establish the taxable base.
  // Discounts reduce the base for 'net' rules; 'gross' rules ignore them.
  // -------------------------------------------------------------------------
  const gross = input.amountMinor;
  const discount = input.discountMinor;
  const netAmount = gross - discount;

  steps.push(
    `Gross amount ${formatMinor(gross, input.currency)} ${input.currency}` +
      (discount !== 0
        ? `, less discount ${formatMinor(discount, input.currency)} = net ${formatMinor(netAmount, input.currency)}`
        : " (no discount applied)"),
  );

  // -------------------------------------------------------------------------
  // Step 2. Refuse uncovered transactions before short-circuiting zero amounts.
  // A zero-value sale still needs a rule on file: otherwise returning 0 would
  // silently hide a catalogue gap behind the degenerate amount.
  // -------------------------------------------------------------------------
  if (rules.length === 0) {
    throw new NoApplicableRuleError(input);
  }

  if (netAmount === 0) {
    steps.push("Amount is zero: no taxable event, no tax due.");
    return emptyResult(input, exponent, opts, "zero_amount", steps, notes, gross, discount);
  }

  const isRefund = netAmount < 0;
  if (isRefund) {
    notes.push(
      "Negative amount treated as a refund / credit note. Tax is reversed at the same " +
        "rate that applied on the transaction date, so the credit exactly offsets the original charge.",
    );
    steps.push("Negative amount detected: processing as a refund at the same rules.");
  }

  // -------------------------------------------------------------------------
  // Step 3. Handle tax-inclusive pricing by decomposing the gross price first.
  // If the submitted price already contains tax, the base is
  //   base = amount * 10000 / (10000 + sum_of_rates)
  // -------------------------------------------------------------------------
  let workingBase = netAmount;
  if (input.priceIncludesTax) {
    const collecting = rules.filter((r) => !(r.treatment in NON_COLLECTING));
    const totalBps = collecting.reduce((sum, r) => sum + r.rateBps, 0);
    if (totalBps > 0) {
      const sign = workingBase < 0 ? -1 : 1;
      workingBase =
        sign * divideRound(Math.abs(workingBase) * 10_000, 10_000 + totalBps, rounding);
      steps.push(
        `Price submitted as tax-inclusive: decomposed ${formatMinor(netAmount, input.currency)} ` +
          `at combined ${bpsToPercent(totalBps)} into base ${formatMinor(workingBase, input.currency)}.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 4. Apply each rule in priority order, stacking where required.
  // -------------------------------------------------------------------------
  let accumulatedTax = 0;

  for (const rule of rules) {
    const baseForRule = rule.taxableBase === "gross" ? gross : workingBase;

    // Threshold check uses the absolute value so refunds mirror the original sale.
    if (rule.thresholdMinor > 0 && Math.abs(baseForRule) < rule.thresholdMinor) {
      steps.push(
        `${rule.taxType} (${rule.id}): skipped. Amount ${formatMinor(baseForRule, input.currency)} ` +
          `is below the ${formatMinor(rule.thresholdMinor, input.currency)} ${input.currency} threshold.`,
      );
      notes.push(`Below-threshold exemption applied via ${rule.id}.`);
      taxLines.push(
        line(
          rule,
          0,
          baseForRule,
          `Below the ${formatMinor(rule.thresholdMinor, input.currency)} ${input.currency} threshold, ` +
            `so no ${rule.taxType} is due (rule would otherwise charge ${bpsToPercent(rule.rateBps)}).`,
          0,
        ),
      );
      continue;
    }

    if (rule.treatment in NON_COLLECTING) {
      steps.push(`${rule.taxType} (${rule.id}): ${NON_COLLECTING[rule.treatment]}`);
      taxLines.push(line(rule, 0, baseForRule, NON_COLLECTING[rule.treatment]));
      continue;
    }

    // Compounding: some municipal taxes are levied on (base + tax already applied).
    const taxableAmount = rule.compoundOnPrevious
      ? baseForRule + accumulatedTax
      : baseForRule;
    const taxAmount = applyRateBps(taxableAmount, rule.rateBps, rounding);
    accumulatedTax += taxAmount;

    steps.push(
      `${rule.taxType} (${rule.id}, ${rule.taxScope}): ${bpsToPercent(rule.rateBps)} of ` +
        `${formatMinor(taxableAmount, input.currency)} = ${formatMinor(taxAmount, input.currency)}` +
        (rule.compoundOnPrevious ? " [compounded on preceding taxes]" : ""),
    );

    taxLines.push(
      line(
        rule,
        taxAmount,
        taxableAmount,
        `${rule.taxType} at ${bpsToPercent(rule.rateBps)} for ` +
          `${rule.productCategory === "*" ? "all categories" : rule.productCategory} in ${rule.countryCode}` +
          (rule.legalReference ? ` (${rule.legalReference})` : ""),
      ),
    );
  }

  const total = workingBase + accumulatedTax;
  const effectiveRateBps =
    workingBase === 0 ? 0 : Math.round((accumulatedTax / workingBase) * 10_000);

  steps.push(
    `Total tax ${formatMinor(accumulatedTax, input.currency)}; ` +
      `total payable ${formatMinor(total, input.currency)} ${input.currency}.`,
  );

  const allNonCollecting = taxLines.every((l) => l.taxAmountMinor === 0);

  return {
    status: isRefund ? "refund" : allNonCollecting ? "exempt" : "calculated",
    currency: input.currency,
    currencyExponent: exponent,
    grossAmountMinor: gross,
    discountMinor: discount,
    baseAmountMinor: workingBase,
    taxAmountMinor: accumulatedTax,
    totalAmountMinor: total,
    effectiveRateBps,
    taxLines,
    rulesetVersion: opts.rulesetVersion,
    engineVersion: ENGINE_VERSION,
    breakdown: {
      summary:
        `${input.countryCode} / ${input.productCategory} / ${input.customerType}: ` +
        `${taxLines.map((l) => `${l.taxType} ${l.ratePercent}`).join(" + ")} ` +
        `= ${bpsToPercent(effectiveRateBps)} effective`,
      steps,
      appliedRuleVersionIds: taxLines.map((l) => l.ruleVersionId),
      notes,
    },
  };
}

function line(
  rule: TaxRuleVersion,
  taxAmountMinor: number,
  taxableAmountMinor: number,
  explanation: string,
  rateOverrideBps?: number,
): TaxLine {
  // A non-collecting treatment reports 0% rather than its nominal rate, so an
  // auditor reading a line never sees a rate that was not actually charged.
  const effectiveBps =
    rateOverrideBps !== undefined
      ? rateOverrideBps
      : taxAmountMinor === 0 && rule.treatment in NON_COLLECTING
        ? 0
        : rule.rateBps;

  return {
    ruleVersionId: rule.id,
    ruleKey: rule.ruleKey,
    ruleVersion: rule.version,
    taxType: rule.taxType,
    taxScope: rule.taxScope,
    treatment: rule.treatment,
    rateBps: effectiveBps,
    ratePercent: bpsToPercent(effectiveBps),
    taxableAmountMinor,
    taxAmountMinor,
    compoundOnPrevious: rule.compoundOnPrevious,
    explanation,
  };
}

function emptyResult(
  input: CalculationInput,
  exponent: number,
  opts: CalculateOptions,
  status: CalculationResult["status"],
  steps: string[],
  notes: string[],
  gross: number,
  discount: number,
): CalculationResult {
  return {
    status,
    currency: input.currency,
    currencyExponent: exponent,
    grossAmountMinor: gross,
    discountMinor: discount,
    baseAmountMinor: 0,
    taxAmountMinor: 0,
    totalAmountMinor: 0,
    effectiveRateBps: 0,
    taxLines: [],
    rulesetVersion: opts.rulesetVersion,
    engineVersion: ENGINE_VERSION,
    breakdown: {
      summary: "Zero-amount transaction: no taxable event.",
      steps,
      appliedRuleVersionIds: [],
      notes,
    },
  };
}
