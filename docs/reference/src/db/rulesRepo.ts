/**
 * Rule persistence. The only place that knows SQL for tax_rule_versions.
 *
 * Invariant enforced here and by database triggers: rules are APPEND-ONLY.
 * "Updating a rate" means inserting a new version and stamping `superseded_at`
 * on the previous one. Nothing that a historical audit record points at ever
 * changes.
 */

import type Database from 'better-sqlite3';
import { getDb } from './index.ts';
import type { TaxRuleVersion } from '../domain/types.ts';

interface RuleRow {
  id: string;
  rule_key: string;
  version: number;
  country_code: string;
  product_category: string;
  customer_type: string;
  tax_type: string;
  tax_scope: string;
  rate_bps: number;
  treatment: string;
  threshold_minor: number;
  taxable_base: string;
  priority: number;
  compound_on_previous: number;
  valid_from: string;
  valid_to: string | null;
  recorded_at: string;
  superseded_at: string | null;
  ruleset_version: number;
  legal_reference: string | null;
  notes: string | null;
}

function toDomain(r: RuleRow): TaxRuleVersion {
  return {
    id: r.id,
    ruleKey: r.rule_key,
    version: r.version,
    countryCode: r.country_code,
    productCategory: r.product_category,
    customerType: r.customer_type,
    taxType: r.tax_type,
    taxScope: r.tax_scope as TaxRuleVersion['taxScope'],
    rateBps: r.rate_bps,
    treatment: r.treatment as TaxRuleVersion['treatment'],
    thresholdMinor: r.threshold_minor,
    taxableBase: r.taxable_base as TaxRuleVersion['taxableBase'],
    priority: r.priority,
    compoundOnPrevious: r.compound_on_previous === 1,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    recordedAt: r.recorded_at,
    supersededAt: r.superseded_at,
    rulesetVersion: r.ruleset_version,
    legalReference: r.legal_reference,
    notes: r.notes,
  };
}

/**
 * Candidate rules for a country, filtered on BOTH time axes in SQL so the
 * pure resolver only has to deal with specificity.
 */
export function findCandidateRules(
  countryCode: string,
  transactionDate: string,
  asOf: string,
  db: Database.Database = getDb(),
): TaxRuleVersion[] {
  const rows = db
    .prepare<[string, string, string, string, string]>(
      `SELECT * FROM tax_rule_versions
        WHERE country_code = ?
          -- VALID TIME: was this the law on the transaction date?
          AND valid_from <= ?
          AND (valid_to IS NULL OR valid_to > ?)
          -- SYSTEM TIME: did we believe it at the as-of instant?
          AND recorded_at <= ?
          AND (superseded_at IS NULL OR superseded_at > ?)`,
    )
    .all(countryCode, transactionDate, transactionDate, asOf, asOf) as RuleRow[];
  return rows.map(toDomain);
}

/** Every currently-believed rule, optionally filtered. For GET /rules. */
export function listRules(
  filter: { countryCode?: string; asOf?: string; onDate?: string; includeSuperseded?: boolean },
  db: Database.Database = getDb(),
): TaxRuleVersion[] {
  const asOf = filter.asOf ?? new Date().toISOString();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.countryCode) {
    clauses.push('country_code = ?');
    params.push(filter.countryCode);
  }
  if (!filter.includeSuperseded) {
    clauses.push('recorded_at <= ? AND (superseded_at IS NULL OR superseded_at > ?)');
    params.push(asOf, asOf);
  }
  if (filter.onDate) {
    clauses.push('valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)');
    params.push(filter.onDate, filter.onDate);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM tax_rule_versions ${where} ORDER BY country_code, rule_key, version`)
    .all(...params) as RuleRow[];
  return rows.map(toDomain);
}

export function listVersionsOfRule(
  ruleKey: string,
  db: Database.Database = getDb(),
): TaxRuleVersion[] {
  const rows = db
    .prepare('SELECT * FROM tax_rule_versions WHERE rule_key = ? ORDER BY version')
    .all(ruleKey) as RuleRow[];
  return rows.map(toDomain);
}

export function currentRulesetVersion(db: Database.Database = getDb()): number {
  const row = db.prepare('SELECT MAX(version) AS v FROM ruleset_versions').get() as { v: number | null };
  return row.v ?? 0;
}

export function newRulesetVersion(note: string, db: Database.Database = getDb()): number {
  const info = db
    .prepare('INSERT INTO ruleset_versions (created_at, change_note) VALUES (?, ?)')
    .run(new Date().toISOString(), note);
  return Number(info.lastInsertRowid);
}

export interface NewRuleInput {
  ruleKey: string;
  countryCode: string;
  productCategory: string;
  customerType?: string;
  taxType: string;
  taxScope?: string;
  rateBps: number;
  treatment?: string;
  thresholdMinor?: number;
  taxableBase?: string;
  priority?: number;
  compoundOnPrevious?: boolean;
  validFrom: string;
  validTo?: string | null;
  legalReference?: string | null;
  notes?: string | null;
}

/**
 * Create the next version of a rule.
 *
 * Supersedes the previous version in SYSTEM TIME (so historical audit records
 * keep resolving to the old row) while leaving its VALID TIME window intact
 * unless the caller closes it.
 */
export function createRuleVersion(
  input: NewRuleInput,
  changeNote: string,
  db: Database.Database = getDb(),
): TaxRuleVersion {
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const rulesetVersion = newRulesetVersion(changeNote, db);

    const prior = db
      .prepare(
        `SELECT * FROM tax_rule_versions
          WHERE rule_key = ? AND superseded_at IS NULL
          ORDER BY version DESC LIMIT 1`,
      )
      .get(input.ruleKey) as RuleRow | undefined;

    const nextVersion = prior ? prior.version + 1 : 1;

    if (prior) {
      // The only mutation ever permitted on this table.
      db.prepare('UPDATE tax_rule_versions SET superseded_at = ? WHERE id = ?').run(now, prior.id);
    }

    const id = `${input.ruleKey}@v${nextVersion}`;
    db.prepare(
      `INSERT INTO tax_rule_versions (
         id, rule_key, version, country_code, product_category, customer_type,
         tax_type, tax_scope, rate_bps, treatment, threshold_minor, taxable_base,
         priority, compound_on_previous, valid_from, valid_to, recorded_at,
         superseded_at, ruleset_version, legal_reference, notes
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`,
    ).run(
      id,
      input.ruleKey,
      nextVersion,
      input.countryCode,
      input.productCategory,
      input.customerType ?? '*',
      input.taxType,
      input.taxScope ?? 'national',
      input.rateBps,
      input.treatment ?? 'standard',
      input.thresholdMinor ?? 0,
      input.taxableBase ?? 'net',
      input.priority ?? 100,
      input.compoundOnPrevious ? 1 : 0,
      input.validFrom,
      input.validTo ?? null,
      now,
      rulesetVersion,
      input.legalReference ?? null,
      input.notes ?? null,
    );

    return db.prepare('SELECT * FROM tax_rule_versions WHERE id = ?').get(id) as RuleRow;
  });

  return toDomain(tx());
}

/** Seed-time insert that lets us backdate `recorded_at` for demo realism. */
export function insertSeedRule(
  input: NewRuleInput & { version?: number; recordedAt?: string; rulesetVersion: number },
  db: Database.Database = getDb(),
): void {
  const version = input.version ?? 1;
  const id = `${input.ruleKey}@v${version}`;
  db.prepare(
    `INSERT OR REPLACE INTO tax_rule_versions (
       id, rule_key, version, country_code, product_category, customer_type,
       tax_type, tax_scope, rate_bps, treatment, threshold_minor, taxable_base,
       priority, compound_on_previous, valid_from, valid_to, recorded_at,
       superseded_at, ruleset_version, legal_reference, notes
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`,
  ).run(
    id,
    input.ruleKey,
    version,
    input.countryCode,
    input.productCategory,
    input.customerType ?? '*',
    input.taxType,
    input.taxScope ?? 'national',
    input.rateBps,
    input.treatment ?? 'standard',
    input.thresholdMinor ?? 0,
    input.taxableBase ?? 'net',
    input.priority ?? 100,
    input.compoundOnPrevious ? 1 : 0,
    input.validFrom,
    input.validTo ?? null,
    input.recordedAt ?? '2024-01-01T00:00:00.000Z',
    input.rulesetVersion,
    input.legalReference ?? null,
    input.notes ?? null,
  );
}
