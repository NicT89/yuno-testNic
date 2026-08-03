/**
 * Tax rule store with date-based version resolution.
 *
 * Rules are persisted in SQLite (`tax_rules`), seeded from `data/tax-rules.json`.
 * For a given (country, region, category, date) we select the single best match.
 */

import { getDb } from "./db";
import type { CountryCode, TaxCategory, TaxRule } from "./types";

interface RuleRow {
  id: string;
  version: number;
  country: string;
  region: string | null;
  category: string;
  rate: number;
  tax_name: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

function mapRule(row: RuleRow): TaxRule {
  return {
    id: row.id,
    version: row.version,
    country: row.country,
    region: row.region,
    category: row.category as TaxCategory,
    rate: row.rate,
    taxName: row.tax_name,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    notes: row.notes ?? undefined,
  };
}

/** Return all rule versions from SQLite. */
export function loadTaxRules(): TaxRule[] {
  const rows = getDb()
    .prepare(
      `SELECT id, version, country, region, category, rate, tax_name,
              effective_from, effective_to, notes
       FROM tax_rules
       ORDER BY id, version`,
    )
    .all() as unknown as RuleRow[];
  return rows.map(mapRule);
}

/**
 * Specificity score used when multiple rules could apply.
 * Regional rules beat country-wide rules.
 */
function specificity(rule: TaxRule, region: string | null | undefined): number {
  if (rule.region && region && rule.region === region) return 2;
  if (rule.region === null) return 1;
  return 0;
}

export interface ResolveRuleInput {
  country: CountryCode;
  region?: string | null;
  category: TaxCategory;
  /** ISO date (YYYY-MM-DD). */
  transactionDate: string;
}

/**
 * Resolve the applicable rule version for a transaction.
 *
 * Algorithm:
 * 1. Filter by country + category + effective date window.
 * 2. Prefer regional match over country-wide.
 * 3. Prefer higher version number when dates overlap.
 */
export function resolveTaxRule(input: ResolveRuleInput): TaxRule | null {
  const { country, region = null, category, transactionDate } = input;

  // Push the cheap filters into SQL; finish specificity/version ranking in JS.
  const rows = getDb()
    .prepare(
      `SELECT id, version, country, region, category, rate, tax_name,
              effective_from, effective_to, notes
       FROM tax_rules
       WHERE country = ?
         AND category = ?
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)
         AND (region IS NULL OR region = ?)`,
    )
    .all(
      country,
      category,
      transactionDate,
      transactionDate,
      region,
    ) as unknown as RuleRow[];

  const candidates = rows.map(mapRule);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const specDiff = specificity(b, region) - specificity(a, region);
    if (specDiff !== 0) return specDiff;
    return b.version - a.version;
  });

  return candidates[0];
}

/** List all versions for a rule id, oldest first. */
export function getRuleHistory(ruleId: string): TaxRule[] {
  const rows = getDb()
    .prepare(
      `SELECT id, version, country, region, category, rate, tax_name,
              effective_from, effective_to, notes
       FROM tax_rules
       WHERE id = ?
       ORDER BY version ASC`,
    )
    .all(ruleId) as unknown as RuleRow[];
  return rows.map(mapRule);
}

/** Filter rules by optional country. */
export function listRules(country?: CountryCode): TaxRule[] {
  if (!country) return loadTaxRules();
  const rows = getDb()
    .prepare(
      `SELECT id, version, country, region, category, rate, tax_name,
              effective_from, effective_to, notes
       FROM tax_rules
       WHERE country = ?
       ORDER BY id, version`,
    )
    .all(country) as unknown as RuleRow[];
  return rows.map(mapRule);
}
