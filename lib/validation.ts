/**
 * The snake_case <-> camelCase translation layer.
 *
 * Requests and responses speak snake_case at the HTTP boundary; everything
 * inside the engine is camelCase. Validation is hand-rolled rather than pulling
 * in a schema library: the surface is small and the dependency budget for this
 * build is zero.
 */

import { CURRENCY_EXPONENTS, COUNTRY_DEFAULT_CURRENCY, toMinor } from "./money";
import { SUPPORTED_COUNTRIES } from "./types";
import type { CalculationInput, CustomerType } from "./types";
import type { NewRuleInput } from "./rules-repo";

export class ValidationError extends Error {
  readonly code = "INVALID_REQUEST";
  readonly field: string | undefined;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

const CUSTOMER_TYPES: CustomerType[] = ["individual", "business"];
const MAX_AMOUNT_MINOR = Math.floor(Number.MAX_SAFE_INTEGER / 10_000);

function requireString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`\`${field}\` is required and must be a string.`, field);
  }
  return value.trim();
}

function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
  fallback: boolean,
): boolean {
  const value = body[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new ValidationError(`\`${field}\` must be a boolean.`, field);
  }
  return value;
}

function optionalInteger(body: Record<string, unknown>, field: string): number | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new ValidationError(
      `\`${field}\` must be a safe integer number of minor currency units.`,
      field,
    );
  }
  return value;
}

/**
 * Amounts may arrive as `amount` (major units, e.g. 199.99) or `amount_minor`
 * (integer centavos). Minor units are authoritative; the major form exists so
 * the curl examples in the README stay readable.
 */
function resolveAmount(
  body: Record<string, unknown>,
  minorField: string,
  majorField: string,
  currency: string,
): number | undefined {
  const minor = optionalInteger(body, minorField);
  if (minor !== undefined) return minor;

  const major = body[majorField];
  if (major === undefined || major === null) return undefined;
  if (typeof major !== "number" && typeof major !== "string") {
    throw new ValidationError(
      `\`${majorField}\` must be a number or a decimal string.`,
      majorField,
    );
  }
  const parsed = toMinor(major, currency);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`\`${majorField}\` is not a valid amount.`, majorField);
  }
  return parsed;
}

/** POST /api/tax/calculate — body to domain input. Throws ValidationError. */
export function toCalculationInput(body: Record<string, unknown>): CalculationInput {
  const countryCode = requireString(body, "country_code").toUpperCase();
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(countryCode)) {
    throw new ValidationError(
      `\`country_code\` must be one of: ${SUPPORTED_COUNTRIES.join(", ")}.`,
      "country_code",
    );
  }

  const currency = (
    typeof body.currency === "string"
      ? body.currency.toUpperCase()
      : COUNTRY_DEFAULT_CURRENCY[countryCode]
  );
  if (!(currency in CURRENCY_EXPONENTS)) {
    throw new ValidationError(
      `Unsupported currency \`${currency}\`. Supported: ${Object.keys(CURRENCY_EXPONENTS).join(", ")}.`,
      "currency",
    );
  }

  const amountMinor = resolveAmount(body, "amount_minor", "amount", currency);
  if (amountMinor === undefined) {
    throw new ValidationError(
      "Provide either `amount` (major units) or `amount_minor` (integer minor units).",
      "amount",
    );
  }
  if (Math.abs(amountMinor) > MAX_AMOUNT_MINOR) {
    throw new ValidationError(
      `\`amount\` exceeds the largest value that can be taxed exactly (${MAX_AMOUNT_MINOR} minor units).`,
      body.amount_minor !== undefined ? "amount_minor" : "amount",
    );
  }

  const discountMinor = resolveAmount(body, "discount_minor", "discount", currency) ?? 0;
  if (discountMinor < 0) {
    throw new ValidationError("`discount` must not be negative.", "discount");
  }
  if (discountMinor > Math.max(amountMinor, 0)) {
    throw new ValidationError(
      "`discount` must not exceed a non-negative sale amount; submit a negative amount for a refund.",
      body.discount_minor !== undefined ? "discount_minor" : "discount",
    );
  }

  const customerType = (body.customer_type ?? "individual") as CustomerType;
  if (!CUSTOMER_TYPES.includes(customerType)) {
    throw new ValidationError(
      `\`customer_type\` must be one of: ${CUSTOMER_TYPES.join(", ")}.`,
      "customer_type",
    );
  }

  let transactionDate = new Date().toISOString();
  if (body.transaction_date !== undefined && body.transaction_date !== null) {
    if (typeof body.transaction_date !== "string") {
      throw new ValidationError("`transaction_date` must be an ISO-8601 string.", "transaction_date");
    }
    const parsed = new Date(body.transaction_date);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError(
        "`transaction_date` must be an ISO-8601 date or timestamp.",
        "transaction_date",
      );
    }
    // Rule windows are stored as canonical ISO strings and compared
    // lexicographically. Normalize offsets so equivalent instants cannot select
    // different versions (for example 23:00-03:00 is 02:00Z the next day).
    transactionDate = parsed.toISOString();
  }

  return {
    amountMinor,
    discountMinor,
    currency,
    countryCode,
    productCategory: requireString(body, "product_category").toLowerCase(),
    customerType,
    transactionDate,
    priceIncludesTax: optionalBoolean(body, "price_includes_tax", false),
  };
}

export function optionalTransactionId(body: Record<string, unknown>): string | undefined {
  if (body.transaction_id === undefined || body.transaction_id === null) return undefined;
  if (typeof body.transaction_id !== "string" || body.transaction_id.length > 128) {
    throw new ValidationError(
      "`transaction_id` must be a string of at most 128 characters.",
      "transaction_id",
    );
  }
  return body.transaction_id;
}

const TAX_SCOPES = ["national", "federal", "state", "municipal"];
const TREATMENTS = ["standard", "reduced", "exempt", "zero_rated", "reverse_charge"];
const TAXABLE_BASES = ["gross", "net"];

function optionalEnum(
  body: Record<string, unknown>,
  field: string,
  allowed: string[],
  fallback: string,
): string {
  const value = body[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ValidationError(`\`${field}\` must be one of: ${allowed.join(", ")}.`, field);
  }
  return value;
}

function requireDateString(body: Record<string, unknown>, field: string): string {
  const value = requireString(body, field);
  if (Number.isNaN(new Date(value).getTime())) {
    throw new ValidationError(`\`${field}\` must be an ISO-8601 date.`, field);
  }
  return value;
}

/**
 * POST/PUT body for a rule write. `ruleKeyFromPath` lets PUT take the key from
 * the URL, where it belongs, while POST carries it in the body.
 */
export function toNewRuleInput(
  body: Record<string, unknown>,
  ruleKeyFromPath?: string,
): NewRuleInput {
  const ruleKey = ruleKeyFromPath ?? requireString(body, "rule_key");

  const countryCode = requireString(body, "country_code").toUpperCase();
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(countryCode)) {
    throw new ValidationError(
      `\`country_code\` must be one of: ${SUPPORTED_COUNTRIES.join(", ")}.`,
      "country_code",
    );
  }

  const rateBps = body.rate_bps;
  if (typeof rateBps !== "number" || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new ValidationError(
      "`rate_bps` must be an integer between 0 and 10000 (basis points; 1900 = 19.00%).",
      "rate_bps",
    );
  }

  const customerType = optionalEnum(body, "customer_type", ["*", "individual", "business"], "*");
  const thresholdMinor = optionalInteger(body, "threshold_minor") ?? 0;
  if (thresholdMinor < 0) {
    throw new ValidationError("`threshold_minor` must not be negative.", "threshold_minor");
  }
  const priority = optionalInteger(body, "priority") ?? 100;

  let validTo: string | null = null;
  if (body.valid_to !== undefined && body.valid_to !== null) {
    validTo = requireDateString(body, "valid_to");
  }

  return {
    ruleKey,
    countryCode,
    productCategory: requireString(body, "product_category").toLowerCase(),
    customerType,
    taxType: requireString(body, "tax_type").toUpperCase(),
    taxScope: optionalEnum(body, "tax_scope", TAX_SCOPES, "national"),
    rateBps,
    treatment: optionalEnum(body, "treatment", TREATMENTS, "standard"),
    thresholdMinor,
    taxableBase: optionalEnum(body, "taxable_base", TAXABLE_BASES, "net"),
    priority,
    compoundOnPrevious: optionalBoolean(body, "compound_on_previous", false),
    validFrom: requireDateString(body, "valid_from"),
    validTo,
    legalReference: typeof body.legal_reference === "string" ? body.legal_reference : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  };
}

export function changeNote(body: Record<string, unknown>, fallback: string): string {
  return typeof body.change_note === "string" && body.change_note.trim()
    ? body.change_note.trim()
    : fallback;
}

/** Validate a `country` query parameter against the supported set. */
export function parseCountryParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const country = value.toUpperCase();
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(country)) {
    throw new ValidationError(
      `\`country\` must be one of: ${SUPPORTED_COUNTRIES.join(", ")}.`,
      "country",
    );
  }
  return country;
}
