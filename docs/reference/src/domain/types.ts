/**
 * Domain types. Everything here is pure data: no IO, no database, no HTTP.
 */

export const ENGINE_VERSION = '1.0.0';

export type CustomerType = 'individual' | 'business';

export type Treatment =
  | 'standard'
  | 'reduced'
  | 'exempt'
  | 'zero_rated'
  | 'reverse_charge';

export type TaxableBase = 'gross' | 'net';

/** One immutable version of one tax rule. Mirrors `tax_rule_versions`. */
export interface TaxRuleVersion {
  id: string;                 // "BR:FOOD:ICMS@v2"
  ruleKey: string;            // "BR:FOOD:ICMS"
  version: number;
  countryCode: string;
  productCategory: string;    // '*' = country default
  customerType: string;       // '*' | 'individual' | 'business'
  taxType: string;            // ICMS, ISS, IVA, IGV, VAT...
  taxScope: 'national' | 'state' | 'municipal';
  rateBps: number;            // basis points: 1900 = 19.00%
  treatment: Treatment;
  thresholdMinor: number;     // rule does not apply below this amount
  taxableBase: TaxableBase;
  priority: number;
  compoundOnPrevious: boolean;
  validFrom: string;
  validTo: string | null;
  recordedAt: string;
  supersededAt: string | null;
  rulesetVersion: number;
  legalReference: string | null;
  notes: string | null;
}

export interface CalculationInput {
  amountMinor: number;          // may be negative (refund) or zero
  discountMinor: number;
  currency: string;
  countryCode: string;
  productCategory: string;
  customerType: CustomerType;
  transactionDate: string;      // ISO-8601, drives VALID-TIME rule selection
  priceIncludesTax: boolean;
}

/** One tax applied to one transaction. Multiple lines = tax stacking. */
export interface TaxLine {
  ruleVersionId: string;
  ruleKey: string;
  ruleVersion: number;
  taxType: string;
  taxScope: string;
  treatment: Treatment;
  rateBps: number;
  ratePercent: string;          // "19.00%" - human readable for the reviewer
  taxableAmountMinor: number;   // what this specific tax was levied on
  taxAmountMinor: number;
  compoundOnPrevious: boolean;
  explanation: string;          // plain-English "why this rule fired"
}

export interface CalculationResult {
  status: 'calculated' | 'exempt' | 'refund' | 'zero_amount';
  currency: string;
  currencyExponent: number;

  grossAmountMinor: number;     // amount as submitted
  discountMinor: number;
  baseAmountMinor: number;      // amount tax was computed on
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
