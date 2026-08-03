import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.TAX_DB_PATH ?? resolve(here, '../../tax-engine.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/** Idempotent schema application. Safe to call on every boot. */
export function migrate(connection: Database.Database): void {
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8');
  connection.exec(sql);
}

export function resetDb(): void {
  const connection = getDb();
  // Triggers block DELETE on the append-only tables, so a reset drops them.
  connection.exec(`
    DROP TRIGGER IF EXISTS trg_audit_no_update;
    DROP TRIGGER IF EXISTS trg_audit_no_delete;
    DROP TRIGGER IF EXISTS trg_rules_append_only;
    DROP TRIGGER IF EXISTS trg_rules_no_delete;
    DROP TABLE IF EXISTS tax_calculation_audit;
    DROP TABLE IF EXISTS tax_rule_versions;
    DROP TABLE IF EXISTS ruleset_versions;
    DROP TABLE IF EXISTS countries;
    DROP TABLE IF EXISTS currencies;
  `);
  migrate(connection);
}
