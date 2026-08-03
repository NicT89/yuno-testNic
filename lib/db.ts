/**
 * SQLite access layer (Node.js built-in `node:sqlite`).
 *
 * The database file is produced by `npm run db:seed` from JSON fixtures and
 * opened read-only at runtime. On Vercel the file is included via
 * `outputFileTracingIncludes` in next.config.ts.
 *
 * Trade-off: serverless filesystems are ephemeral — this demo treats SQLite as
 * a read-mostly rule/transaction store shipped with the deploy. Durable writes
 * would need an external store (e.g. Turso/libSQL). See NOTES.md.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

let db: DatabaseSync | null = null;

export function getDbPath(): string {
  return join(process.cwd(), "data", "yuno-tax.db");
}

/**
 * Open (or return cached) read-only connection to the seeded SQLite file.
 */
export function getDb(): DatabaseSync {
  if (db) return db;

  const path = getDbPath();
  if (!existsSync(path)) {
    throw new Error(
      `SQLite database not found at ${path}. Run \`npm run db:seed\` before starting the server.`,
    );
  }

  // readOnly avoids accidental mutation in serverless /tmp-less deploys
  db = new DatabaseSync(path, { readOnly: true });
  return db;
}

/** Close cached connection — used by tests / seed refresh. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
