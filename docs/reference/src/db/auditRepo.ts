/**
 * Compliance audit trail persistence.
 *
 * Every calculation request writes exactly one row, including rejected ones.
 * Rows are immutable (enforced by database triggers), so the trail can be
 * handed to a tax authority as-is.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { getDb } from './index.ts';
import type { CalculationInput, CalculationResult, TaxRuleVersion } from '../domain/types.ts';
import { ENGINE_VERSION } from '../domain/types.ts';

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
  appliedRuleVersionIds: string[];
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
  return createHash('sha256').update(canonical).digest('hex');
}

export function writeAudit(
  record: {
    transactionId: string;
    transactionDate: string;
    input: CalculationInput;
    rawInput: unknown;
    result: CalculationResult | null;
    error: { code: string; message: string } | null;
    rulesetVersion: number;
    appliedRules: TaxRuleVersion[];
    idempotencyKey?: string | null;
  },
  db: Database.Database = getDb(),
): AuditRecord {
  const now = new Date().toISOString();
  const { input, result } = record;

  const row = {
    transaction_id: record.transactionId,
    created_at: now,
    transaction_date: record.transactionDate,
    input_amount_minor: input.amountMinor,
    input_discount_minor: input.discountMinor,
    input_currency: input.currency,
    input_country_code: input.countryCode,
    input_product_category: input.productCategory,
    input_customer_type: input.customerType,
    input_price_includes_tax: input.priceIncludesTax ? 1 : 0,
    input_payload_json: JSON.stringify(record.rawInput),
    status: record.error ? 'error' : (result?.status ?? 'error'),
    base_amount_minor: result?.baseAmountMinor ?? 0,
    tax_amount_minor: result?.taxAmountMinor ?? 0,
    total_amount_minor: result?.totalAmountMinor ?? 0,
    effective_rate_bps: result?.effectiveRateBps ?? 0,
    output_payload_json: JSON.stringify(result ?? { error: record.error }),
    error_code: record.error?.code ?? null,
    error_message: record.error?.message ?? null,
    ruleset_version: record.rulesetVersion,
    applied_rule_version_ids: JSON.stringify(record.appliedRules.map((r) => r.id)),
    applied_rules_snapshot: JSON.stringify(record.appliedRules),
    engine_version: ENGINE_VERSION,
    calculation_fingerprint: fingerprint(input, record.rulesetVersion),
    idempotency_key: record.idempotencyKey ?? null,
  };

  db.prepare(
    `INSERT INTO tax_calculation_audit (
      transaction_id, created_at, transaction_date,
      input_amount_minor, input_discount_minor, input_currency, input_country_code,
      input_product_category, input_customer_type, input_price_includes_tax, input_payload_json,
      status, base_amount_minor, tax_amount_minor, total_amount_minor, effective_rate_bps,
      output_payload_json, error_code, error_message,
      ruleset_version, applied_rule_version_ids, applied_rules_snapshot,
      engine_version, calculation_fingerprint, idempotency_key
    ) VALUES (
      @transaction_id, @created_at, @transaction_date,
      @input_amount_minor, @input_discount_minor, @input_currency, @input_country_code,
      @input_product_category, @input_customer_type, @input_price_includes_tax, @input_payload_json,
      @status, @base_amount_minor, @tax_amount_minor, @total_amount_minor, @effective_rate_bps,
      @output_payload_json, @error_code, @error_message,
      @ruleset_version, @applied_rule_version_ids, @applied_rules_snapshot,
      @engine_version, @calculation_fingerprint, @idempotency_key
    )`,
  ).run(row);

  return getAudit(record.transactionId, db)!;
}

interface AuditRow {
  [k: string]: any;
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
    error: r.error_code ? { code: r.error_code, message: r.error_message } : null,
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
  db: Database.Database = getDb(),
): AuditRecord | null {
  const row = db
    .prepare('SELECT * FROM tax_calculation_audit WHERE transaction_id = ?')
    .get(transactionId) as AuditRow | undefined;
  return row ? toDomain(row) : null;
}

export function findByIdempotencyKey(
  key: string,
  db: Database.Database = getDb(),
): AuditRecord | null {
  const row = db
    .prepare('SELECT * FROM tax_calculation_audit WHERE idempotency_key = ?')
    .get(key) as AuditRow | undefined;
  return row ? toDomain(row) : null;
}

export function listAudit(
  filter: { countryCode?: string; from?: string; to?: string; limit?: number; offset?: number },
  db: Database.Database = getDb(),
): AuditRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.countryCode) {
    clauses.push('input_country_code = ?');
    params.push(filter.countryCode);
  }
  if (filter.from) {
    clauses.push('transaction_date >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push('transaction_date <= ?');
    params.push(filter.to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM tax_calculation_audit ${where}
        ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filter.limit ?? 100, filter.offset ?? 0) as AuditRow[];
  return rows.map(toDomain);
}

// -----------------------------------------------------------------------------
// Compliance report. Aggregation happens in SQL, which is where it belongs:
// a monthly filing for 450,000 transactions cannot be built in application
// memory.
// -----------------------------------------------------------------------------

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  countryCode: string;
  period: { from: string; to: string };
  currency: string | null;
  totals: {
    transactionsProcessed: number;
    successfulCalculations: number;
    grossBaseAmountMinor: number;
    totalTaxCollectedMinor: number;
    totalPayableMinor: number;
    averageEffectiveRateBps: number;
  };
  byCategory: Array<{
    productCategory: string;
    transactions: number;
    baseAmountMinor: number;
    taxAmountMinor: number;
    effectiveRateBps: number;
  }>;
  byTaxType: Array<{ taxType: string; taxAmountMinor: number; transactions: number }>;
  edgeCases: {
    zeroAmount: number;
    refunds: number;
    exempt: number;
    belowThreshold: number;
    errors: number;
    errorDetail: Array<{ code: string; count: number; sample: string }>;
  };
  rulesetVersionsInPeriod: number[];
}

export function buildComplianceReport(
  countryCode: string,
  from: string,
  to: string,
  db: Database.Database = getDb(),
): ComplianceReport {
  const where = 'WHERE input_country_code = ? AND transaction_date >= ? AND transaction_date <= ?';
  const p = [countryCode, from, to];

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS n,
              SUM(CASE WHEN status != 'error' THEN 1 ELSE 0 END) AS ok,
              COALESCE(SUM(base_amount_minor), 0) AS base,
              COALESCE(SUM(tax_amount_minor), 0) AS tax,
              COALESCE(SUM(total_amount_minor), 0) AS total
         FROM tax_calculation_audit ${where}`,
    )
    .get(...p) as any;

  const byCategory = db
    .prepare(
      `SELECT input_product_category AS productCategory,
              COUNT(*) AS transactions,
              COALESCE(SUM(base_amount_minor), 0) AS baseAmountMinor,
              COALESCE(SUM(tax_amount_minor), 0) AS taxAmountMinor
         FROM tax_calculation_audit ${where}
        GROUP BY input_product_category
        ORDER BY taxAmountMinor DESC`,
    )
    .all(...p) as any[];

  const currencyRow = db
    .prepare(`SELECT input_currency AS c, COUNT(*) n FROM tax_calculation_audit ${where} GROUP BY 1 ORDER BY n DESC LIMIT 1`)
    .get(...p) as any;

  const edge = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'zero_amount' THEN 1 ELSE 0 END) AS zeroAmount,
         SUM(CASE WHEN status = 'refund' THEN 1 ELSE 0 END) AS refunds,
         SUM(CASE WHEN status = 'exempt' THEN 1 ELSE 0 END) AS exempt,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
       FROM tax_calculation_audit ${where}`,
    )
    .get(...p) as any;

  const errorDetail = db
    .prepare(
      `SELECT error_code AS code, COUNT(*) AS count, MIN(error_message) AS sample
         FROM tax_calculation_audit ${where} AND error_code IS NOT NULL
        GROUP BY error_code`,
    )
    .all(...p) as any[];

  const belowThreshold = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tax_calculation_audit ${where}
        AND output_payload_json LIKE '%Below-threshold exemption%'`,
    )
    .get(...p) as any;

  const rulesetVersions = db
    .prepare(`SELECT DISTINCT ruleset_version AS v FROM tax_calculation_audit ${where} ORDER BY v`)
    .all(...p) as any[];

  // Tax-type split comes from the applied-rules snapshot, which is exactly why
  // the snapshot is denormalised onto every audit row.
  const taxTypeTotals = new Map<string, { taxAmountMinor: number; transactions: number }>();
  const rows = db
    .prepare(`SELECT output_payload_json FROM tax_calculation_audit ${where} AND status != 'error'`)
    .all(...p) as any[];
  for (const row of rows) {
    const out = JSON.parse(row.output_payload_json);
    for (const line of out.taxLines ?? []) {
      const cur = taxTypeTotals.get(line.taxType) ?? { taxAmountMinor: 0, transactions: 0 };
      cur.taxAmountMinor += line.taxAmountMinor;
      cur.transactions += 1;
      taxTypeTotals.set(line.taxType, cur);
    }
  }

  const base = Number(totals.base) || 0;
  const tax = Number(totals.tax) || 0;

  return {
    reportId: `RPT-${countryCode}-${from.slice(0, 10)}-${to.slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    countryCode,
    period: { from, to },
    currency: currencyRow?.c ?? null,
    totals: {
      transactionsProcessed: Number(totals.n) || 0,
      successfulCalculations: Number(totals.ok) || 0,
      grossBaseAmountMinor: base,
      totalTaxCollectedMinor: tax,
      totalPayableMinor: Number(totals.total) || 0,
      averageEffectiveRateBps: base === 0 ? 0 : Math.round((tax / base) * 10_000),
    },
    byCategory: byCategory.map((c) => ({
      productCategory: c.productCategory,
      transactions: c.transactions,
      baseAmountMinor: c.baseAmountMinor,
      taxAmountMinor: c.taxAmountMinor,
      effectiveRateBps:
        c.baseAmountMinor === 0 ? 0 : Math.round((c.taxAmountMinor / c.baseAmountMinor) * 10_000),
    })),
    byTaxType: [...taxTypeTotals.entries()].map(([taxType, v]) => ({ taxType, ...v })),
    edgeCases: {
      zeroAmount: Number(edge.zeroAmount) || 0,
      refunds: Number(edge.refunds) || 0,
      exempt: Number(edge.exempt) || 0,
      belowThreshold: Number(belowThreshold.n) || 0,
      errors: Number(edge.errors) || 0,
      errorDetail: errorDetail.map((e) => ({ code: e.code, count: e.count, sample: e.sample })),
    },
    rulesetVersionsInPeriod: rulesetVersions.map((r) => r.v),
  };
}
