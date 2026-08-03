/**
 * Seed script: `npm run seed`
 *
 * 1. Resets the database.
 * 2. Loads currencies, countries and 26 versioned tax rules.
 * 3. Runs all 56 fixture transactions through the real service so the audit
 *    trail and compliance reports have data the moment the reviewer starts.
 */

import { getDb, resetDb } from '../db/index.ts';
import { insertSeedRule, newRulesetVersion } from '../db/rulesRepo.ts';
import { calculate } from '../service/taxService.ts';
import { COUNTRIES, CURRENCIES, SEED_RULES } from './rules.ts';
import { SEED_TRANSACTIONS } from './transactions.ts';

const COUNTRY_CURRENCY: Record<string, string> = {
  BR: 'BRL', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN',
};

export function seed(runTransactions = true) {
  const db = getDb();
  resetDb();

  const insertCurrency = db.prepare('INSERT INTO currencies (code, exponent, name) VALUES (?,?,?)');
  for (const c of CURRENCIES) insertCurrency.run(c.code, c.exponent, c.name);

  const insertCountry = db.prepare(
    'INSERT INTO countries (code, name, default_currency, rounding_mode) VALUES (?,?,?,?)',
  );
  for (const c of COUNTRIES) insertCountry.run(c.code, c.name, c.currency, c.rounding);

  const rulesetVersion = newRulesetVersion('Initial seeded rule catalogue (2020-2026 LATAM)');
  for (const rule of SEED_RULES) insertSeedRule({ ...rule, rulesetVersion });

  let ok = 0;
  let errors = 0;
  if (runTransactions) {
    for (const t of SEED_TRANSACTIONS) {
      try {
        calculate({
          transactionId: t.transactionId,
          input: {
            amountMinor: t.amountMinor,
            discountMinor: t.discountMinor ?? 0,
            currency: COUNTRY_CURRENCY[t.countryCode],
            countryCode: t.countryCode,
            productCategory: t.productCategory,
            customerType: t.customerType,
            transactionDate: t.transactionDate,
            priceIncludesTax: t.priceIncludesTax ?? false,
          },
          rawRequest: t,
        });
        ok++;
      } catch {
        errors++;
      }
    }
  }

  return { rules: SEED_RULES.length, rulesetVersion, transactions: ok, errors };
}

const isMain = process.argv[1]?.includes('seed');
if (isMain) {
  const r = seed();
  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${r.rules} tax rule versions (ruleset v${r.rulesetVersion}), ` +
      `${r.transactions} transactions calculated, ${r.errors} audited as errors.`,
  );
}
