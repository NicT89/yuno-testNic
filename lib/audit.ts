/**
 * Compliance audit trail persistence.
 *
 * Every calculation request writes exactly one row, including rejected ones. A
 * compliance log that silently drops events is a broken compliance log — the
 * failures are precisely the transactions an auditor asks about.
 *
 * Rows are immutable: `trg_audit_no_update` and `trg_audit_no_delete` in
 * scripts/schema.sql make that a database guarantee rather than a claim in the
 * README. There is deliberately no update path in this module.
 */

import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import type { CalculationInput, CalculationResult, TaxRuleVersion } from "./types";
import { ENGINE_VERSION } from "./types";

export interface AuditRecord {
  transactionId: string;
  createdAt: string;
  transactionDate: string;
  input: Record<string, unknown>;
  status: string;
  baseAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
  effectiveRateBps: number;
  output: Record<string, unknown>;
  error: { code: string; message: string } | null;
  rulesetVersion: number;
  /** Provenance: which rule versions were applied. */
  appliedRuleVersionIds: string[];
  /** The same rules copied in full, so the record stands on its own. */
  appliedRulesSnapshot: TaxRuleVersion[];
  engineVersion: string;
  calculationFingerprint: string;
  idempotencyKey: string | null;
}

/**
 * Deterministic fingerprint of the inputs plus the ruleset they were priced
 * against. Two requests with the same fingerprint MUST produce the same
 * output; that is the service's idempotency guarantee, stated as data.
 */
export function fingerprint(input: CalculationInput, rulesetVersion: number): string {
  const canonical = JSON.stringify({
    a: input.amountMinor,
    d: input.discountMinor,
    c: input.currency,
    k: input.countryCode,
    p: input.productCategory,
    t: input.customerType,
    dt: input.transactionDate,
    i: input.priceIncludesTax,
    rv: rulesetVersion,
    ev: ENGINE_VERSION,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface WriteAuditInput {
  transactionId: string;
  transactionDate: string;
  input: CalculationInput;
  /** The raw request body, stored verbatim. */
  rawInput: unknown;
  result: CalculationResult | null;
  error: { code: string; message: string } | null;
  rulesetVersion: number;
  appliedRules: TaxRuleVersion[];
  idempotencyKey?: string | null;
}

export function writeAudit(
  record: WriteAuditInput,
  db: DatabaseSync = getDb(),
): AuditRecord {
  const now = new Date().toISOString();
  const { input, result } = record;

  db.prepare(
    `INSERT INTO tax_calculation_audit (
      transaction_id, created_at, transaction_date,
      input_amount_minor, input_discount_minor, input_currency, input_country_code,
      input_product_category, input_customer_type, input_price_includes_tax, input_payload_json,
      status, base_amount_minor, tax_amount_minor, total_amount_minor, effective_rate_bps,
      output_payload_json, error_code, error_message,
      ruleset_version, applied_rule_version_ids, applied_rules_snapshot,
      engine_version, calculation_fingerprint, idempotency_key
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    record.transactionId,
    now,
    record.transactionDate,
    input.amountMinor,
    input.discountMinor,
    input.currency,
    input.countryCode,
    input.productCategory,
    input.customerType,
    input.priceIncludesTax ? 1 : 0,
    JSON.stringify(record.rawInput),
    record.error ? "error" : (result?.status ?? "error"),
    result?.baseAmountMinor ?? 0,
    result?.taxAmountMinor ?? 0,
    result?.totalAmountMinor ?? 0,
    result?.effectiveRateBps ?? 0,
    JSON.stringify(result ?? { error: record.error }),
    record.error?.code ?? null,
    record.error?.message ?? null,
    record.rulesetVersion,
    // Both stored on purpose: the ids prove provenance against the rule table,
    // the snapshot makes the row readable by an auditor with no access to it.
    JSON.stringify(record.appliedRules.map((r) => r.id)),
    JSON.stringify(record.appliedRules),
    ENGINE_VERSION,
    fingerprint(input, record.rulesetVersion),
    record.idempotencyKey ?? null,
  );

  return getAudit(record.transactionId, db)!;
}

interface AuditRow {
  transaction_id: string;
  created_at: string;
  transaction_date: string;
  input_amount_minor: number;
  input_discount_minor: number;
  input_currency: string;
  input_country_code: string;
  input_product_category: string;
  input_customer_type: string;
  input_price_includes_tax: number;
  input_payload_json: string;
  status: string;
  base_amount_minor: number;
  tax_amount_minor: number;
  total_amount_minor: number;
  effective_rate_bps: number;
  output_payload_json: string;
  error_code: string | null;
  error_message: string | null;
  ruleset_version: number;
  applied_rule_version_ids: string;
  applied_rules_snapshot: string;
  engine_version: string;
  calculation_fingerprint: string;
  idempotency_key: string | null;
}

function toDomain(r: AuditRow): AuditRecord {
  return {
    transactionId: r.transaction_id,
    createdAt: r.created_at,
    transactionDate: r.transaction_date,
    input: {
      amountMinor: r.input_amount_minor,
      discountMinor: r.input_discount_minor,
      currency: r.input_currency,
      countryCode: r.input_country_code,
      productCategory: r.input_product_category,
      customerType: r.input_customer_type,
      priceIncludesTax: r.input_price_includes_tax === 1,
      raw: JSON.parse(r.input_payload_json),
    },
    status: r.status,
    baseAmountMinor: r.base_amount_minor,
    taxAmountMinor: r.tax_amount_minor,
    totalAmountMinor: r.total_amount_minor,
    effectiveRateBps: r.effective_rate_bps,
    output: JSON.parse(r.output_payload_json),
    error: r.error_code ? { code: r.error_code, message: r.error_message ?? "" } : null,
    rulesetVersion: r.ruleset_version,
    appliedRuleVersionIds: JSON.parse(r.applied_rule_version_ids),
    appliedRulesSnapshot: JSON.parse(r.applied_rules_snapshot),
    engineVersion: r.engine_version,
    calculationFingerprint: r.calculation_fingerprint,
    idempotencyKey: r.idempotency_key,
  };
}

export function getAudit(
  transactionId: string,
  db: DatabaseSync = getDb(),
): AuditRecord | null {
  const row = db
    .prepare("SELECT * FROM tax_calculation_audit WHERE transaction_id = ?")
    .get(transactionId) as unknown as AuditRow | undefined;
  return row ? toDomain(row) : null;
}

export function findByIdempotencyKey(
  key: string,
  db: DatabaseSync = getDb(),
): AuditRecord | null {
  const row = db
    .prepare("SELECT * FROM tax_calculation_audit WHERE idempotency_key = ?")
    .get(key) as unknown as AuditRow | undefined;
  return row ? toDomain(row) : null;
}

export interface ListAuditFilter {
  countryCode?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function auditWhere(filter: ListAuditFilter): {
  where: string;
  params: (string | number)[];
} {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter.countryCode) {
    clauses.push("input_country_code = ?");
    params.push(filter.countryCode);
  }
  if (filter.from) {
    clauses.push("transaction_date >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push("transaction_date <= ?");
    params.push(filter.to);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function listAudit(
  filter: ListAuditFilter,
  db: DatabaseSync = getDb(),
): AuditRecord[] {
  const { where, params } = auditWhere(filter);
  const rows = db
    .prepare(
      `SELECT * FROM tax_calculation_audit ${where}
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, filter.limit ?? 100, filter.offset ?? 0) as unknown as AuditRow[];
  return rows.map(toDomain);
}

export function countAudit(
  filter: ListAuditFilter = {},
  db: DatabaseSync = getDb(),
): number {
  const { where, params } = auditWhere(filter);
  const row = db.prepare(`SELECT COUNT(*) AS n FROM tax_calculation_audit ${where}`).get(...params) as
    | { n: number }
    | undefined;
  return row?.n ?? 0;
}
