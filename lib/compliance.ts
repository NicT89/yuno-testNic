/**
 * Compliance report generator.
 *
 * Aggregates taxed transactions for a single country into a structure suitable
 * for filings / internal audit: totals, category breakdown, and rule-version
 * breakdown (so rate changes mid-period are visible).
 *
 * Transactions are loaded from SQLite (`transactions` table).
 */

import { calculateTax } from "./calculator";
import { getDb } from "./db";
import type {
  ComplianceReport,
  TaxAmountMode,
  TaxCategory,
  TaxedTransaction,
  Transaction,
} from "./types";

interface TxnRow {
  id: string;
  country: string;
  region: string | null;
  category: string;
  amount: number;
  amount_mode: string;
  currency: string;
  transaction_date: string;
  description: string;
}

function mapTxn(row: TxnRow): Transaction {
  return {
    id: row.id,
    country: row.country,
    region: row.region,
    category: row.category as TaxCategory,
    amount: row.amount,
    amountMode: row.amount_mode as TaxAmountMode,
    currency: row.currency,
    transactionDate: row.transaction_date,
    description: row.description,
  };
}

export function loadTransactions(): Transaction[] {
  const rows = getDb()
    .prepare(
      `SELECT id, country, region, category, amount, amount_mode,
              currency, transaction_date, description
       FROM transactions
       ORDER BY transaction_date, id`,
    )
    .all() as unknown as TxnRow[];
  return rows.map(mapTxn);
}

export interface ReportOptions {
  country: string;
  /** Inclusive period start (YYYY-MM-DD). Defaults to earliest txn. */
  from?: string;
  /** Inclusive period end (YYYY-MM-DD). Defaults to latest txn. */
  to?: string;
}

function taxTransaction(txn: Transaction): TaxedTransaction {
  const tax = calculateTax({
    country: txn.country,
    region: txn.region,
    category: txn.category,
    amount: txn.amount,
    amountMode: txn.amountMode,
    transactionDate: txn.transactionDate,
    currency: txn.currency,
  });
  return { transaction: txn, tax };
}

/**
 * Build a compliance report for one country over an optional date window.
 */
export function generateComplianceReport(options: ReportOptions): ComplianceReport {
  const all = loadTransactions().filter((t) => t.country === options.country);

  if (all.length === 0) {
    throw new Error(`No sample transactions found for country=${options.country}`);
  }

  const dates = all.map((t) => t.transactionDate).sort();
  const from = options.from ?? dates[0];
  const to = options.to ?? dates[dates.length - 1];

  const filtered = all.filter(
    (t) => t.transactionDate >= from && t.transactionDate <= to,
  );

  if (filtered.length === 0) {
    throw new Error(
      `No transactions for country=${options.country} in period ${from}..${to}`,
    );
  }

  const taxed = filtered.map(taxTransaction);
  const currency = taxed[0].tax.currency;

  const summary = taxed.reduce(
    (acc, row) => {
      acc.transactionCount += 1;
      acc.totalNet += row.tax.netAmount;
      acc.totalTax += row.tax.taxAmount;
      acc.totalGross += row.tax.grossAmount;
      return acc;
    },
    { transactionCount: 0, totalNet: 0, totalTax: 0, totalGross: 0 },
  );

  const categoryMap = new Map<
    TaxCategory,
    { transactionCount: number; totalNet: number; totalTax: number; rate: number | null }
  >();
  for (const row of taxed) {
    const existing = categoryMap.get(row.tax.category) ?? {
      transactionCount: 0,
      totalNet: 0,
      totalTax: 0,
      rate: row.tax.rate,
    };
    existing.transactionCount += 1;
    existing.totalNet += row.tax.netAmount;
    existing.totalTax += row.tax.taxAmount;
    if (existing.rate !== row.tax.rate) existing.rate = null;
    categoryMap.set(row.tax.category, existing);
  }

  const ruleMap = new Map<
    string,
    {
      ruleId: string;
      version: number;
      taxName: string;
      rate: number;
      transactionCount: number;
      totalTax: number;
    }
  >();
  for (const row of taxed) {
    const key = `${row.tax.appliedRule.id}@v${row.tax.appliedRule.version}`;
    const existing = ruleMap.get(key) ?? {
      ruleId: row.tax.appliedRule.id,
      version: row.tax.appliedRule.version,
      taxName: row.tax.taxName,
      rate: row.tax.rate,
      transactionCount: 0,
      totalTax: 0,
    };
    existing.transactionCount += 1;
    existing.totalTax += row.tax.taxAmount;
    ruleMap.set(key, existing);
  }

  return {
    generatedAt: new Date().toISOString(),
    country: options.country,
    currency,
    period: { from, to },
    summary,
    byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
    })),
    byRuleVersion: Array.from(ruleMap.values()),
    transactions: taxed,
  };
}

/**
 * Render a human-readable text compliance report (also available as JSON via API).
 */
export function formatComplianceReportText(report: ComplianceReport): string {
  const fmt = (minor: number) =>
    `${(minor / 100).toFixed(2)} ${report.currency}`;

  const lines: string[] = [
    `COMPLIANCE TAX REPORT — ${report.country}`,
    `Generated: ${report.generatedAt}`,
    `Period:    ${report.period.from} → ${report.period.to}`,
    ``,
    `SUMMARY`,
    `  Transactions: ${report.summary.transactionCount}`,
    `  Total net:    ${fmt(report.summary.totalNet)}`,
    `  Total tax:    ${fmt(report.summary.totalTax)}`,
    `  Total gross:  ${fmt(report.summary.totalGross)}`,
    ``,
    `BY CATEGORY`,
  ];

  for (const row of report.byCategory) {
    const rateLabel = row.rate === null ? "mixed" : `${(row.rate * 100).toFixed(2)}%`;
    lines.push(
      `  ${row.category.padEnd(12)} count=${row.transactionCount}  net=${fmt(row.totalNet)}  tax=${fmt(row.totalTax)}  rate=${rateLabel}`,
    );
  }

  lines.push(``, `BY RULE VERSION`);
  for (const row of report.byRuleVersion) {
    lines.push(
      `  ${row.ruleId}@v${row.version} (${row.taxName}, ${(row.rate * 100).toFixed(2)}%)  count=${row.transactionCount}  tax=${fmt(row.totalTax)}`,
    );
  }

  lines.push(``, `TRANSACTIONS`);
  for (const row of report.transactions) {
    lines.push(
      `  ${row.transaction.id}  ${row.transaction.transactionDate}  ${row.transaction.description}`,
    );
    lines.push(
      `    net=${fmt(row.tax.netAmount)}  tax=${fmt(row.tax.taxAmount)}  gross=${fmt(row.tax.grossAmount)}  rule=${row.tax.appliedRule.id}@v${row.tax.appliedRule.version}`,
    );
  }

  lines.push(``);
  return lines.join("\n");
}
