/**
 * Rule resolution. PURE function: candidates in, applicable rules out.
 * No database, no HTTP, no clock — both time instants are passed in.
 *
 * TWO INDEPENDENT TIME AXES (see scripts/schema.sql for the full rationale):
 *
 *   valid time  (validFrom / validTo)       selected by TRANSACTION DATE
 *       "which rate was the law when this sale happened?"
 *
 *   system time (recordedAt / supersededAt) selected by AS-OF INSTANT
 *       "which rate did we believe at the moment we computed this?"
 *
 * Recalculating a historical transaction with `asOf` pinned to the original
 * `created_at` reproduces the original answer, even if a reviewer has since
 * edited the rule. That is the whole point of keeping the axes separate.
 */

import type { TaxRuleVersion } from "./types";

export interface ResolveQuery {
  countryCode: string;
  productCategory: string;
  customerType: string;
  /** ISO-8601. Drives VALID-TIME selection. */
  transactionDate: string;
  /** ISO-8601. Drives SYSTEM-TIME selection. */
  asOf: string;
}

const WILDCARD = "*";

function withinValidTime(rule: TaxRuleVersion, transactionDate: string): boolean {
  if (transactionDate < rule.validFrom) return false;
  if (rule.validTo !== null && transactionDate >= rule.validTo) return false;
  return true;
}

function withinSystemTime(rule: TaxRuleVersion, asOf: string): boolean {
  if (asOf < rule.recordedAt) return false;
  if (rule.supersededAt !== null && asOf >= rule.supersededAt) return false;
  return true;
}

/**
 * Specificity score. A rule written for the exact category beats a country-wide
 * default; a rule written for the exact customer type beats a wildcard. This is
 * how "Argentina digital services for a business" picks the reverse-charge rule
 * rather than the generic 21% IVA rule.
 */
function specificity(rule: TaxRuleVersion): number {
  let score = 0;
  if (rule.productCategory !== WILDCARD) score += 4;
  if (rule.customerType !== WILDCARD) score += 2;
  return score;
}

function matches(rule: TaxRuleVersion, q: ResolveQuery): boolean {
  if (rule.countryCode !== q.countryCode) return false;
  if (
    rule.productCategory !== WILDCARD &&
    rule.productCategory !== q.productCategory
  ) {
    return false;
  }
  if (rule.customerType !== WILDCARD && rule.customerType !== q.customerType) {
    return false;
  }
  return withinValidTime(rule, q.transactionDate) && withinSystemTime(rule, q.asOf);
}

/**
 * Returns every tax that applies to this transaction, ordered by `priority`.
 *
 * A country may levy several taxes on one sale (Brazil: state ICMS plus
 * municipal ISS on digital services). We therefore resolve ONE winning rule
 * PER tax type rather than one rule overall — that is what makes stacking work
 * without letting two competing ICMS versions both fire.
 */
export function resolveApplicableRules(
  candidates: TaxRuleVersion[],
  q: ResolveQuery,
): TaxRuleVersion[] {
  const applicable = candidates.filter((r) => matches(r, q));

  const winnerByTaxType = new Map<string, TaxRuleVersion>();
  for (const rule of applicable) {
    const current = winnerByTaxType.get(rule.taxType);
    if (!current) {
      winnerByTaxType.set(rule.taxType, rule);
      continue;
    }
    const better =
      specificity(rule) > specificity(current) ||
      (specificity(rule) === specificity(current) && rule.version > current.version);
    if (better) winnerByTaxType.set(rule.taxType, rule);
  }

  return [...winnerByTaxType.values()].sort(
    (a, b) => a.priority - b.priority || a.taxType.localeCompare(b.taxType),
  );
}
