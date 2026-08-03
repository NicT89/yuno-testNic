/**
 * Core domain types for the tax calculation service.
 *
 * Design note: amounts are stored as integer minor units (cents) to avoid
 * floating-point rounding errors that are unacceptable in tax computations.
 */

/** ISO 3166-1 alpha-2 country code, e.g. "US", "MX", "CO". */
export type CountryCode = string;

/** Product / service category used to select the applicable tax rate. */
export type TaxCategory =
  | "standard"
  | "reduced"
  | "zero_rated"
  | "exempt"
  | "digital"
  | "food"
  | "clothing";

/** How the transaction amount relates to tax. */
export type TaxAmountMode = "exclusive" | "inclusive";

/**
 * A versioned tax rule.
 *
 * Versioning strategy: each rule has an `id` (stable identity) and a
 * `version` (monotonically increasing integer). Validity is also bounded by
 * `effectiveFrom` / `effectiveTo` so historical calculations can resolve the
 * rule that was in force on the transaction date — critical for audits and
 * amended returns.
 */
export interface TaxRule {
  /** Stable rule identity across versions, e.g. "mx-iva-standard". */
  id: string;
  /** Monotonic version number for this rule id. */
  version: number;
  country: CountryCode;
  /** Optional subdivision (US state, MX state, etc.). Null = country-wide. */
  region: string | null;
  category: TaxCategory;
  /** Tax rate as a decimal fraction, e.g. 0.16 for 16% IVA. */
  rate: number;
  /** Human-readable tax name shown on invoices / reports. */
  taxName: string;
  /** Inclusive start date (ISO 8601 date). */
  effectiveFrom: string;
  /** Exclusive end date, or null if still active. */
  effectiveTo: string | null;
  /** Short rationale for auditors (why this rate applies). */
  notes?: string;
}

/** Input line used when calculating tax for a single purchase. */
export interface TaxCalculationRequest {
  country: CountryCode;
  region?: string | null;
  category: TaxCategory;
  /** Amount in minor units (cents). */
  amount: number;
  /** Whether `amount` already includes tax. Defaults to "exclusive". */
  amountMode?: TaxAmountMode;
  /** Transaction date used for rule version resolution. Defaults to today. */
  transactionDate?: string;
  currency?: string;
}

/** Breakdown returned by the calculation engine. */
export interface TaxCalculationResult {
  country: CountryCode;
  region: string | null;
  category: TaxCategory;
  currency: string;
  amountMode: TaxAmountMode;
  /** Net (pre-tax) amount in minor units. */
  netAmount: number;
  /** Tax amount in minor units. */
  taxAmount: number;
  /** Gross (net + tax) amount in minor units. */
  grossAmount: number;
  /** Applied rate as a decimal fraction. */
  rate: number;
  taxName: string;
  /** The specific rule version that was applied. */
  appliedRule: {
    id: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  /** True when a zero or exempt rule matched (taxAmount will be 0). */
  exempt: boolean;
}

/** A recorded commerce transaction used for batch reporting. */
export interface Transaction {
  id: string;
  country: CountryCode;
  region: string | null;
  category: TaxCategory;
  /** Transaction amount in minor units. */
  amount: number;
  amountMode: TaxAmountMode;
  currency: string;
  /** ISO 8601 date of the transaction. */
  transactionDate: string;
  description: string;
}

/** A transaction plus its calculated tax result. */
export interface TaxedTransaction {
  transaction: Transaction;
  tax: TaxCalculationResult;
}

/** Aggregated compliance report for one country. */
export interface ComplianceReport {
  generatedAt: string;
  country: CountryCode;
  currency: string;
  period: {
    from: string;
    to: string;
  };
  summary: {
    transactionCount: number;
    totalNet: number;
    totalTax: number;
    totalGross: number;
  };
  /** Tax totals rolled up by category. */
  byCategory: Array<{
    category: TaxCategory;
    transactionCount: number;
    totalNet: number;
    totalTax: number;
    rate: number | null;
  }>;
  /** Tax totals rolled up by applied rule version (audit trail). */
  byRuleVersion: Array<{
    ruleId: string;
    version: number;
    taxName: string;
    rate: number;
    transactionCount: number;
    totalTax: number;
  }>;
  transactions: TaxedTransaction[];
}
