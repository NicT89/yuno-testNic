/**
 * Build data/yuno-tax.db from JSON fixtures.  Usage: npm run db:seed
 *
 * JSON under data/ stays the editable source of truth; the runtime API reads
 * exclusively from the SQLite file produced here, against the bitemporal schema
 * in scripts/schema.sql.
 *
 * Fixture transactions are replayed through the REAL tax service rather than
 * inserted as rows, so the audit trail and the compliance report have genuine,
 * self-consistent data the moment a reviewer starts poking at the API.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { closeDb, pinToSeededDatabase } from "../lib/db";
import { insertSeedRule, newRulesetVersion, type NewRuleInput } from "../lib/rules-repo";
import { calculate } from "../lib/tax-service";
import { COUNTRY_DEFAULT_CURRENCY } from "../lib/money";
import { SUPPORTED_COUNTRIES, type CustomerType } from "../lib/types";

interface SeedRule extends NewRuleInput {
  version?: number;
  recordedAt?: string;
}

/** Shape of a fixture in data/transactions.json. */
interface SeedTransaction {
  transactionId: string;
  amountMinor: number;
  discountMinor?: number;
  countryCode: string;
  productCategory: string;
  customerType: CustomerType;
  transactionDate: string;
  priceIncludesTax?: boolean;
  note?: string;
}

const CURRENCIES = [
  { code: "BRL", exponent: 2, name: "Brazilian real" },
  { code: "COP", exponent: 2, name: "Colombian peso" },
  { code: "ARS", exponent: 2, name: "Argentine peso" },
  { code: "CLP", exponent: 0, name: "Chilean peso" }, // no minor unit
  { code: "PEN", exponent: 2, name: "Peruvian sol" },
  { code: "USD", exponent: 2, name: "US dollar" },
];

const COUNTRIES = [
  { code: "BR", name: "Brazil", currency: "BRL", rounding: "HALF_UP" },
  { code: "CO", name: "Colombia", currency: "COP", rounding: "HALF_UP" },
  { code: "AR", name: "Argentina", currency: "ARS", rounding: "HALF_UP" },
  { code: "CL", name: "Chile", currency: "CLP", rounding: "HALF_UP" },
  { code: "PE", name: "Peru", currency: "PEN", rounding: "HALF_UP" },
];

const dataDir = join(process.cwd(), "data");
const dbPath = join(dataDir, "yuno-tax.db");

mkdirSync(dataDir, { recursive: true });
// Remove the WAL sidecars too, or a stale journal resurrects deleted rows.
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
}

const rules = JSON.parse(
  readFileSync(join(dataDir, "tax-rules.json"), "utf-8"),
) as SeedRule[];

// ---- 1. schema + reference data ---------------------------------------------
// The schema lives in SQL, not in TypeScript string literals: it is the primary
// artefact for the bitemporal design and is commented for a reviewer.
const db = new DatabaseSync(dbPath);
db.exec(readFileSync(join(process.cwd(), "scripts", "schema.sql"), "utf-8"));

const insertCurrency = db.prepare(
  "INSERT INTO currencies (code, exponent, name) VALUES (?,?,?)",
);
for (const c of CURRENCIES) insertCurrency.run(c.code, c.exponent, c.name);

const insertCountry = db.prepare(
  "INSERT INTO countries (code, name, default_currency, rounding_mode) VALUES (?,?,?,?)",
);
for (const c of COUNTRIES) insertCountry.run(c.code, c.name, c.currency, c.rounding);

// ---- 2. the rule catalogue ---------------------------------------------------
const rulesetVersion = newRulesetVersion(
  "Initial seeded rule catalogue (2020-2026 LATAM: BR, CO, AR, CL, PE)",
  db,
);
for (const rule of rules) insertSeedRule({ ...rule, rulesetVersion }, db);

db.close();

// ---- 3. replay the fixtures through the service to populate the audit trail --
// Pin the service to the artefact we just built. On Vercel, VERCEL=1 is set at
// BUILD time too, and without this the rows would go to the build container's
// /tmp and never reach the deployed lambda.
pinToSeededDatabase();

const transactions = JSON.parse(
  readFileSync(join(dataDir, "transactions.json"), "utf-8"),
) as unknown[];

function asSeedTransaction(row: unknown): SeedTransaction | null {
  if (!row || typeof row !== "object") return null;
  const t = row as Record<string, unknown>;
  if (typeof t.countryCode !== "string" || typeof t.amountMinor !== "number") return null;
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(t.countryCode)) return null;
  return t as unknown as SeedTransaction;
}

let calculated = 0;
let audited = 0;
let skipped = 0;

for (const row of transactions) {
  const t = asSeedTransaction(row);
  if (!t) {
    skipped++;
    continue;
  }
  try {
    calculate({
      transactionId: t.transactionId,
      input: {
        amountMinor: t.amountMinor,
        discountMinor: t.discountMinor ?? 0,
        currency: COUNTRY_DEFAULT_CURRENCY[t.countryCode],
        countryCode: t.countryCode,
        productCategory: t.productCategory,
        customerType: t.customerType,
        transactionDate: t.transactionDate,
        priceIncludesTax: t.priceIncludesTax ?? false,
      },
      rawRequest: t,
    });
    calculated++;
  } catch {
    // The service already wrote an audit row for the failure; that is the point.
    audited++;
  }
}

closeDb();

console.log(
  `Seeded ${dbPath}\n` +
    `  ${rules.length} tax rule versions (ruleset v${rulesetVersion}) across ${COUNTRIES.length} countries\n` +
    `  ${calculated} fixture transactions calculated, ${audited} audited as errors`,
);
if (skipped > 0) {
  console.warn(
    `  WARNING: ${skipped} fixture(s) in data/transactions.json were skipped — they are not in the\n` +
      `  { transactionId, amountMinor, countryCode: BR|CO|AR|CL|PE, productCategory, customerType,\n` +
      `    transactionDate } shape this engine expects. See T6 in docs/02-BUILD-PLAN.md.`,
  );
}
