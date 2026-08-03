/**
 * Core domain types. Pure data: no IO, no database, no HTTP, no clock.
 *
 * Two conventions run through everything here and are not negotiable:
 *   - money is an integer count of MINOR UNITS (centavos, and whole pesos for
 *     CLP, which has no minor unit at all);
 *   - rates are integer BASIS POINTS, so 19% is 1900 and never 0.19.
 * See lib/money.ts for why.
 */

export const ENGINE_VERSION = "1.0.0";

/** The five jurisdictions this engine is seeded for. */
export const SUPPORTED_COUNTRIES = ["BR", "CO", "AR", "CL", "PE"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export type CustomerType = "individual" | "business";

export type Treatment =
  | "standard"
  | "reduced"
  | "exempt"
  | "zero_rated"
  | "reverse_charge";

/** 'gross' taxes the pre-discount amount, 'net' the post-discount amount. */
export type TaxableBase = "gross" | "net";

export type TaxScope = "national" | "federal" | "state" | "municipal";

/**
 * One immutable version of one tax rule. Mirrors a row of `tax_rule_versions`.
 *
 * `ruleKey` is the stable identity of the rule across its whole life
 * ("BR:ELECTRONICS:ICMS"); `id` identifies one frozen version of it
 * ("BR:ELECTRONICS:ICMS@v2"). Audit records point at the `id`, which is what
 * makes a historical calculation reproducible after a rate change.
 */
export interface TaxRuleVersion {
  id: string;
  ruleKey: string;
  version: number;
  countryCode: string;
  /** '*' = country-wide default. */
  productCategory: string;
  /** '*' | 'individual' | 'business'. */
  customerType: string;
  taxType: string;
  taxScope: TaxScope;
  rateBps: number;
  treatment: Treatment;
  /** The rule does not apply at all below this amount. */
  thresholdMinor: number;
  taxableBase: TaxableBase;
  /** Stack order when several taxes apply to one sale. Lower runs first. */
  priority: number;
  /** Levy on (base + tax accumulated so far) rather than on the base alone. */
  compoundOnPrevious: boolean;

  /** VALID TIME: when this rule was the law. Selected by the transaction date. */
  validFrom: string;
  validTo: string | null;

  /** SYSTEM TIME: when we believed it. Selected by an as-of instant. */
  recordedAt: string;
  supersededAt: string | null;

  rulesetVersion: number;
  legalReference: string | null;
  notes: string | null;
}

export interface CalculationInput {
  /** May be zero (no taxable event) or negative (refund / credit note). */
  amountMinor: number;
  discountMinor: number;
  currency: string;
  countryCode: string;
  productCategory: string;
  customerType: CustomerType;
  /** ISO-8601. Drives VALID-TIME rule selection. */
  transactionDate: string;
  priceIncludesTax: boolean;
}

/** One tax applied to one transaction. Several lines = tax stacking. */
export interface TaxLine {
  ruleVersionId: string;
  ruleKey: string;
  ruleVersion: number;
  taxType: string;
  taxScope: string;
  treatment: Treatment;
  rateBps: number;
  /** Human-readable form of rateBps, e.g. "19.00%". */
  ratePercent: string;
  /** What this specific tax was levied on. */
  taxableAmountMinor: number;
  taxAmountMinor: number;
  compoundOnPrevious: boolean;
  /** Plain-English "why this rule fired", for the auditor. */
  explanation: string;
}

export interface CalculationResult {
  status: "calculated" | "exempt" | "refund" | "zero_amount";
  currency: string;
  currencyExponent: number;

  /** Amount as submitted, before discount. */
  grossAmountMinor: number;
  discountMinor: number;
  /** Amount tax was actually computed on. */
  baseAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
  effectiveRateBps: number;

  taxLines: TaxLine[];
  rulesetVersion: number;
  engineVersion: string;

  /** Human-readable trace of every decision the engine made. */
  breakdown: {
    summary: string;
    steps: string[];
    appliedRuleVersionIds: string[];
    notes: string[];
  };
}
