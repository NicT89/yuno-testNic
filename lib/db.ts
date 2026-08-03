/**
 * SQLite access layer (Node.js built-in `node:sqlite`).
 *
 * The database is built by `npm run db:seed` from `data/tax-rules.json` against
 * `scripts/schema.sql`, and is opened READ-WRITE at runtime: the audit trail is
 * a write path, and every calculation must record one row.
 *
 * Trade-off on Vercel: serverless filesystems are read-only apart from /tmp, so
 * the bundled database is copied to /tmp on first use. Audit rows written there
 * survive the warm instance but not a cold start — durable multi-instance
 * writes would need an external store (e.g. Turso/libSQL). See NOTES.md.
 * Immutability of the trail is enforced by triggers in scripts/schema.sql, so
 * it holds wherever the file lives.
 */

import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let db: DatabaseSync | null = null;
let pathOverride: string | null = null;

/** The seeded artefact checked into `data/`, bundled with the deploy. */
export function getSeededDbPath(): string {
  return join(process.cwd(), "data", "yuno-tax.db");
}

/**
 * Seed-time only: pin every connection to the artefact that ships with the
 * deploy.
 *
 * Vercel sets VERCEL=1 during the BUILD as well as at runtime, so without this
 * the fixture replay in scripts/seed-db.ts would write its audit rows into the
 * build container's /tmp and throw them away — shipping a database with rules
 * and an empty audit trail, which is exactly the failure the /tmp copy below
 * exists to prevent.
 */
export function pinToSeededDatabase(): void {
  pathOverride = getSeededDbPath();
  closeDb();
}

/** Where the process actually opens the database for reads and writes. */
export function getDbPath(): string {
  if (pathOverride) return pathOverride;

  const seeded = getSeededDbPath();
  if (!process.env.VERCEL) return seeded;

  const writable = join(tmpdir(), "yuno-tax.db");
  if (!existsSync(writable) && existsSync(seeded)) copyFileSync(seeded, writable);
  return writable;
}

/** Open (or return the cached) read-write connection to the seeded database. */
export function getDb(): DatabaseSync {
  if (db) return db;

  const path = getDbPath();
  if (!existsSync(path)) {
    throw new Error(
      `SQLite database not found at ${path}. Run \`npm run db:seed\` before starting the server.`,
    );
  }

  db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

/**
 * Run `fn` inside a transaction. `node:sqlite` has no transaction helper, so
 * this is the one place that speaks BEGIN/COMMIT/ROLLBACK.
 */
export function inTransaction<T>(fn: () => T, target: DatabaseSync = getDb()): T {
  target.exec("BEGIN");
  try {
    const out = fn();
    target.exec("COMMIT");
    return out;
  } catch (err) {
    target.exec("ROLLBACK");
    throw err;
  }
}

/** Close the cached connection — used by tests / seed refresh. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
