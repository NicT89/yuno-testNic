/**
 * Build data/yuno-tax.db from JSON fixtures.
 *
 * JSON under data/ remains the editable source of truth for the take-home.
 * Runtime APIs read exclusively from the SQLite file produced here.
 *
 * Usage: npm run db:seed
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

interface TaxRuleRow {
  id: string;
  version: number;
  country: string;
  region: string | null;
  category: string;
  rate: number;
  taxName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes?: string;
}

interface TransactionRow {
  id: string;
  country: string;
  region: string | null;
  category: string;
  amount: number;
  amountMode: string;
  currency: string;
  transactionDate: string;
  description: string;
}

const root = process.cwd();
const dataDir = join(root, "data");
const dbPath = join(dataDir, "yuno-tax.db");

mkdirSync(dataDir, { recursive: true });
if (existsSync(dbPath)) unlinkSync(dbPath);

const rules = JSON.parse(
  readFileSync(join(dataDir, "tax-rules.json"), "utf-8"),
) as TaxRuleRow[];
const transactions = JSON.parse(
  readFileSync(join(dataDir, "transactions.json"), "utf-8"),
) as TransactionRow[];

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE tax_rules (
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    category TEXT NOT NULL,
    rate REAL NOT NULL,
    tax_name TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    notes TEXT,
    PRIMARY KEY (id, version)
  );

  CREATE INDEX idx_tax_rules_lookup
    ON tax_rules (country, category, effective_from, effective_to);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    region TEXT,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    amount_mode TEXT NOT NULL CHECK (amount_mode IN ('exclusive', 'inclusive')),
    currency TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE INDEX idx_transactions_country_date
    ON transactions (country, transaction_date);
`);

const insertRule = db.prepare(`
  INSERT INTO tax_rules (
    id, version, country, region, category, rate, tax_name,
    effective_from, effective_to, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTxn = db.prepare(`
  INSERT INTO transactions (
    id, country, region, category, amount, amount_mode,
    currency, transaction_date, description
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec("BEGIN");
for (const rule of rules) {
  insertRule.run(
    rule.id,
    rule.version,
    rule.country,
    rule.region,
    rule.category,
    rule.rate,
    rule.taxName,
    rule.effectiveFrom,
    rule.effectiveTo,
    rule.notes ?? null,
  );
}
for (const txn of transactions) {
  insertTxn.run(
    txn.id,
    txn.country,
    txn.region,
    txn.category,
    txn.amount,
    txn.amountMode,
    txn.currency,
    txn.transactionDate,
    txn.description,
  );
}
db.exec("COMMIT");
db.close();

console.log(
  `Seeded ${dbPath} with ${rules.length} tax rule versions and ${transactions.length} transactions.`,
);
