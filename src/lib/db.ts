import { Pool } from "pg";

/**
 * Lazy singleton Postgres pool. Cached on globalThis so Next.js dev-mode
 * hot reloads don't leak pools. Throws only when actually used without
 * DATABASE_URL — the app must still build and boot with zero secrets.
 */

const globalForDb = globalThis as unknown as { frmakePgPool?: Pool };

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — the credit ledger needs Postgres.");
  }
  globalForDb.frmakePgPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
  return globalForDb.frmakePgPool;
}
