/**
 * Compliance report: the artefact a finance team actually files.
 *
 * Aggregation happens IN SQL, not in a JavaScript loop over the rows. A monthly
 * filing for 450,000 transactions cannot be assembled in application memory,
 * and a report that only works at fixture scale is not a report.
 *
 * The source is the audit trail, not the rule table: the report states what was
 * actually charged, which is what a tax authority asks about.
 */

import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import { COUNTRY_DEFAULT_CURRENCY, formatMinor } from "./money";

export interface ComplianceReport {
  disclaimer: string;
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
  byTaxType: Array<{ taxType: string; taxAmountMinor: number; taxLines: number }>;
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
  db: DatabaseSync = getDb(),
): ComplianceReport {
  const where =
    "WHERE input_country_code = ? AND transaction_date >= ? AND transaction_date <= ?";
  const p = [countryCode, from, to] as const;

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS n,
              SUM(CASE WHEN status != 'error' THEN 1 ELSE 0 END) AS ok,
              COALESCE(SUM(base_amount_minor), 0) AS base,
              COALESCE(SUM(tax_amount_minor), 0) AS tax,
              COALESCE(SUM(total_amount_minor), 0) AS total
         FROM tax_calculation_audit ${where}`,
    )
    .get(...p) as {
    n: number;
    ok: number | null;
    base: number;
    tax: number;
    total: number;
  };

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
    .all(...p) as unknown as Array<{
    productCategory: string;
    transactions: number;
    baseAmountMinor: number;
    taxAmountMinor: number;
  }>;

  // The tax-type split is unnested from the stored tax lines with json_each,
  // so multi-tax stacking (PIS/COFINS + ISS on one sale) reports per tax rather than
  // collapsing into a single figure. Still one SQL statement.
  const byTaxType = db
    .prepare(
      `SELECT json_extract(line.value, '$.taxType')        AS taxType,
              SUM(json_extract(line.value, '$.taxAmountMinor')) AS taxAmountMinor,
              COUNT(*)                                     AS taxLines
         FROM tax_calculation_audit a,
              json_each(json_extract(a.output_payload_json, '$.taxLines')) line
        WHERE a.input_country_code = ?
          AND a.transaction_date >= ?
          AND a.transaction_date <= ?
          AND a.status != 'error'
        GROUP BY taxType
        ORDER BY taxAmountMinor DESC`,
    )
    .all(...p) as unknown as Array<{
    taxType: string;
    taxAmountMinor: number;
    taxLines: number;
  }>;

  const currencyRow = db
    .prepare(
      `SELECT input_currency AS c, COUNT(*) AS n
         FROM tax_calculation_audit ${where}
        GROUP BY input_currency ORDER BY n DESC LIMIT 1`,
    )
    .get(...p) as { c: string; n: number } | undefined;

  const edge = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'zero_amount' THEN 1 ELSE 0 END) AS zeroAmount,
         SUM(CASE WHEN status = 'refund'      THEN 1 ELSE 0 END) AS refunds,
         SUM(CASE WHEN status = 'exempt'      THEN 1 ELSE 0 END) AS exempt,
         SUM(CASE WHEN status = 'error'       THEN 1 ELSE 0 END) AS errors,
         SUM(CASE WHEN output_payload_json LIKE '%Below-threshold exemption%'
                  THEN 1 ELSE 0 END)                             AS belowThreshold
       FROM tax_calculation_audit ${where}`,
    )
    .get(...p) as Record<string, number | null>;

  const errorDetail = db
    .prepare(
      `SELECT error_code AS code, COUNT(*) AS count, MIN(error_message) AS sample
         FROM tax_calculation_audit ${where} AND error_code IS NOT NULL
        GROUP BY error_code`,
    )
    .all(...p) as unknown as Array<{ code: string; count: number; sample: string }>;

  const rulesetVersions = db
    .prepare(
      `SELECT DISTINCT ruleset_version AS v FROM tax_calculation_audit ${where} ORDER BY v`,
    )
    .all(...p) as unknown as Array<{ v: number }>;

  const base = Number(totals.base) || 0;
  const tax = Number(totals.tax) || 0;

  return {
    disclaimer: "Illustrative tax data. Not tax advice.",
    reportId: `RPT-${countryCode}-${from.slice(0, 10)}-${to.slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    countryCode,
    period: { from, to },
    // An empty filing period still belongs to a known jurisdiction and must be
    // renderable as JSON or CSV; `null` previously made formatMinor("XXX") throw.
    currency: currencyRow?.c ?? COUNTRY_DEFAULT_CURRENCY[countryCode] ?? null,
    totals: {
      transactionsProcessed: Number(totals.n) || 0,
      successfulCalculations: Number(totals.ok) || 0,
      grossBaseAmountMinor: base,
      totalTaxCollectedMinor: tax,
      totalPayableMinor: Number(totals.total) || 0,
      averageEffectiveRateBps: base === 0 ? 0 : Math.round((tax / base) * 10_000),
    },
    byCategory: byCategory.map((c) => ({
      ...c,
      effectiveRateBps:
        c.baseAmountMinor === 0
          ? 0
          : Math.round((c.taxAmountMinor / c.baseAmountMinor) * 10_000),
    })),
    byTaxType,
    edgeCases: {
      zeroAmount: Number(edge.zeroAmount) || 0,
      refunds: Number(edge.refunds) || 0,
      exempt: Number(edge.exempt) || 0,
      belowThreshold: Number(edge.belowThreshold) || 0,
      errors: Number(edge.errors) || 0,
      errorDetail,
    },
    rulesetVersionsInPeriod: rulesetVersions.map((r) => r.v),
  };
}

/** CSV rendering of the same report, for finance teams that live in a spreadsheet. */
export function formatComplianceReportCsv(report: ComplianceReport): string {
  const cur = report.currency ?? "XXX";
  return [
    "product_category,transactions,base_amount,tax_amount,effective_rate",
    ...report.byCategory.map((c) =>
      [
        c.productCategory,
        c.transactions,
        formatMinor(c.baseAmountMinor, cur),
        formatMinor(c.taxAmountMinor, cur),
        `${(c.effectiveRateBps / 100).toFixed(2)}%`,
      ].join(","),
    ),
    [
      "TOTAL",
      report.totals.transactionsProcessed,
      formatMinor(report.totals.grossBaseAmountMinor, cur),
      formatMinor(report.totals.totalTaxCollectedMinor, cur),
      `${(report.totals.averageEffectiveRateBps / 100).toFixed(2)}%`,
    ].join(","),
  ].join("\n");
}
