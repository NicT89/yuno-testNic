/**
 * Rule persistence. The only place that knows SQL for `tax_rule_versions`.
 *
 * Invariant enforced here and by database triggers: rules are APPEND-ONLY.
 * "Updating a rate" means inserting a new version and stamping `superseded_at`
 * on the previous one. Nothing a historical audit record points at ever
 * changes.
 *
 * Layering: this is an outer-layer module. It imports the pure domain types but
 * lib/rules.ts (the resolver) never imports this.
 */

import type { DatabaseSync } from "node:sqlite";
import { getDb, inTransaction } from "./db";
import type { RoundingMode } from "./money";
import type { TaxRuleVersion } from "./types";

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
    taxScope: r.tax_scope as TaxRuleVersion["taxScope"],
    rateBps: r.rate_bps,
    treatment: r.treatment as TaxRuleVersion["treatment"],
    thresholdMinor: r.threshold_minor,
    taxableBase: r.taxable_base as TaxRuleVersion["taxableBase"],
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
 * Candidate rules for a country, filtered on BOTH time axes in SQL so the pure
 * resolver only has to deal with specificity.
 */
export function findCandidateRules(
  countryCode: string,
  transactionDate: string,
  asOf: string,
  db: DatabaseSync = getDb(),
): TaxRuleVersion[] {
  const rows = db
    .prepare(
      `SELECT * FROM tax_rule_versions
        WHERE country_code = ?
          -- VALID TIME: was this the law on the transaction date?
          AND valid_from <= ?
          AND (valid_to IS NULL OR valid_to > ?)
          -- SYSTEM TIME: did we believe it at the as-of instant?
          AND recorded_at <= ?
          AND (superseded_at IS NULL OR superseded_at > ?)`,
    )
    .all(countryCode, transactionDate, transactionDate, asOf, asOf) as unknown as RuleRow[];
  return rows.map(toDomain);
}

export interface ListRulesFilter {
  countryCode?: string;
  /** SYSTEM TIME instant. Defaults to now. */
  asOf?: string;
  /** VALID TIME date: rules that were the law on this date. */
  onDate?: string;
  /** Include versions we have already replaced. */
  includeSuperseded?: boolean;
}

/** Rules for GET /api/tax/rules, filterable on either time axis. */
export function listRules(
  filter: ListRulesFilter,
  db: DatabaseSync = getDb(),
): TaxRuleVersion[] {
  const asOf = filter.asOf ?? new Date().toISOString();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.countryCode) {
    clauses.push("country_code = ?");
    params.push(filter.countryCode);
  }
  if (!filter.includeSuperseded) {
    clauses.push("recorded_at <= ? AND (superseded_at IS NULL OR superseded_at > ?)");
    params.push(asOf, asOf);
  }
  if (filter.onDate) {
    clauses.push("valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)");
    params.push(filter.onDate, filter.onDate);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM tax_rule_versions ${where}
        ORDER BY country_code, rule_key, version`,
    )
    .all(...params) as unknown as RuleRow[];
  return rows.map(toDomain);
}

/** Full lineage of one rule key, oldest version first. */
export function listVersionsOfRule(
  ruleKey: string,
  db: DatabaseSync = getDb(),
): TaxRuleVersion[] {
  const rows = db
    .prepare("SELECT * FROM tax_rule_versions WHERE rule_key = ? ORDER BY version")
    .all(ruleKey) as unknown as RuleRow[];
  return rows.map(toDomain);
}

/**
 * The rounding mode a country's tax authority expects. Chile rounds to whole
 * pesos, Brazil to centavos; a jurisdiction that mandated banker's rounding
 * would be a one-row change here rather than a code change.
 */
export function countryRoundingMode(
  countryCode: string,
  db: DatabaseSync = getDb(),
): RoundingMode {
  const row = db
    .prepare("SELECT rounding_mode AS mode FROM countries WHERE code = ?")
    .get(countryCode) as { mode: string } | undefined;

  const mode = row?.mode;
  return mode === "HALF_EVEN" || mode === "DOWN" || mode === "HALF_UP" ? mode : "HALF_UP";
}

export function currentRulesetVersion(db: DatabaseSync = getDb()): number {
  const row = db.prepare("SELECT MAX(version) AS v FROM ruleset_versions").get() as
    | { v: number | null }
    | undefined;
  return row?.v ?? 0;
}

export function newRulesetVersion(note: string, db: DatabaseSync = getDb()): number {
  const info = db
    .prepare("INSERT INTO ruleset_versions (created_at, change_note) VALUES (?, ?)")
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

const INSERT_RULE_SQL = `
  INSERT INTO tax_rule_versions (
    id, rule_key, version, country_code, product_category, customer_type,
    tax_type, tax_scope, rate_bps, treatment, threshold_minor, taxable_base,
    priority, compound_on_previous, valid_from, valid_to, recorded_at,
    superseded_at, ruleset_version, legal_reference, notes
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`;

function insertRuleRow(
  db: DatabaseSync,
  input: NewRuleInput,
  version: number,
  recordedAt: string,
  rulesetVersion: number,
): string {
  const id = `${input.ruleKey}@v${version}`;
  db.prepare(INSERT_RULE_SQL).run(
    id,
    input.ruleKey,
    version,
    input.countryCode,
    input.productCategory,
    input.customerType ?? "*",
    input.taxType,
    input.taxScope ?? "national",
    input.rateBps,
    input.treatment ?? "standard",
    input.thresholdMinor ?? 0,
    input.taxableBase ?? "net",
    input.priority ?? 100,
    input.compoundOnPrevious ? 1 : 0,
    input.validFrom,
    input.validTo ?? null,
    recordedAt,
    rulesetVersion,
    input.legalReference ?? null,
    input.notes ?? null,
  );
  return id;
}

/** The version of a rule we currently believe, or null if the key is unknown. */
export function getCurrentRuleVersion(
  ruleKey: string,
  db: DatabaseSync = getDb(),
): TaxRuleVersion | null {
  const row = db
    .prepare(
      `SELECT * FROM tax_rule_versions
        WHERE rule_key = ? AND superseded_at IS NULL
        ORDER BY version DESC LIMIT 1`,
    )
    .get(ruleKey) as unknown as RuleRow | undefined;
  return row ? toDomain(row) : null;
}

export interface RuleWriteOutcome {
  /** The version this write replaced, or null when the rule is brand new. */
  previous: TaxRuleVersion | null;
  created: TaxRuleVersion;
  rulesetVersion: number;
}

/**
 * Create the next version of a rule.
 *
 * Supersedes the previous version in SYSTEM TIME (so historical audit records
 * keep resolving to the old row) while leaving its VALID TIME window intact
 * unless the caller closes it. Stamping `superseded_at` is the only mutation
 * this table ever permits, and the trigger in scripts/schema.sql rejects the
 * rest.
 */
export function createRuleVersion(
  input: NewRuleInput,
  changeNote: string,
  db: DatabaseSync = getDb(),
): RuleWriteOutcome {
  const now = new Date().toISOString();

  return inTransaction(() => {
    const rulesetVersion = newRulesetVersion(changeNote, db);
    const previous = getCurrentRuleVersion(input.ruleKey, db);

    const nextVersion = previous ? previous.version + 1 : 1;
    if (previous) {
      db.prepare("UPDATE tax_rule_versions SET superseded_at = ? WHERE id = ?").run(
        now,
        previous.id,
      );
    }

    const id = insertRuleRow(db, input, nextVersion, now, rulesetVersion);
    const row = db
      .prepare("SELECT * FROM tax_rule_versions WHERE id = ?")
      .get(id) as unknown as RuleRow;

    // Re-read the previous row so the caller sees its stamped supersededAt.
    const previousAfter = previous
      ? toDomain(
          db
            .prepare("SELECT * FROM tax_rule_versions WHERE id = ?")
            .get(previous.id) as unknown as RuleRow,
        )
      : null;

    return { previous: previousAfter, created: toDomain(row), rulesetVersion };
  }, db);
}

/**
 * "Delete" a rule: close its VALID TIME window instead of removing it.
 *
 * Implemented as an append: a new version carrying `validTo` is inserted and
 * the prior one is superseded. Nothing is erased, so a transaction dated before
 * the closing date still resolves and still reports the rate it was charged.
 * (The append-only trigger would reject an in-place `valid_to` UPDATE anyway —
 * the storage model enforces this, it is not merely a convention.)
 */
export function closeRuleVersion(
  ruleKey: string,
  validTo: string,
  changeNote: string,
  db: DatabaseSync = getDb(),
): RuleWriteOutcome | null {
  const current = getCurrentRuleVersion(ruleKey, db);
  if (!current) return null;

  return createRuleVersion(
    {
      ruleKey: current.ruleKey,
      countryCode: current.countryCode,
      productCategory: current.productCategory,
      customerType: current.customerType,
      taxType: current.taxType,
      taxScope: current.taxScope,
      rateBps: current.rateBps,
      treatment: current.treatment,
      thresholdMinor: current.thresholdMinor,
      taxableBase: current.taxableBase,
      priority: current.priority,
      compoundOnPrevious: current.compoundOnPrevious,
      validFrom: current.validFrom,
      validTo,
      legalReference: current.legalReference,
      notes:
        `Closed ${validTo} via DELETE /api/tax/rules/${ruleKey}. ` +
        `Retained for historical calculations. ${current.notes ?? ""}`.trim(),
    },
    changeNote,
    db,
  );
}

/**
 * Seed-time insert. Unlike createRuleVersion it takes an explicit version and a
 * backdated `recorded_at`, so the catalogue can ship with real history (two
 * versions of the Brazil electronics rule) rather than everything being
 * recorded the instant the seed ran.
 */
export function insertSeedRule(
  input: NewRuleInput & { version?: number; recordedAt?: string; rulesetVersion: number },
  db: DatabaseSync = getDb(),
): void {
  insertRuleRow(
    db,
    input,
    input.version ?? 1,
    input.recordedAt ?? "2024-01-01T00:00:00.000Z",
    input.rulesetVersion,
  );
}
