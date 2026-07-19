// Applies every db/migrations/*.sql in filename order. Idempotent: each
// migration must be written with IF NOT EXISTS-style guards. Run with
// `npm run db:migrate` (needs DATABASE_URL, e.g. from .env.local).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url });
await client.connect();
for (const file of files) {
  await client.query(await readFile(join(dir, file), "utf8"));
  console.log(`applied ${file}`);
}
await client.end();
