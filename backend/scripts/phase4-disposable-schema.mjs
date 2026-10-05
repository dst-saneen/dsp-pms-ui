/**
 * Phase 4 A2 helper — create/drop a disposable schema on the same RDS instance.
 * Usage:
 *   node scripts/phase4-disposable-schema.mjs create
 *   node scripts/phase4-disposable-schema.mjs drop
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const action = process.argv[2];
const disposableSchema = process.env.DISPOSABLE_SCHEMA || "dsp_pms_phase4_disposable";

if (!["create", "drop"].includes(action)) {
  console.error("Usage: node scripts/phase4-disposable-schema.mjs <create|drop>");
  process.exit(1);
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(disposableSchema)) {
  throw new Error("Invalid disposable schema name.");
}

const env = Object.fromEntries(
  readFileSync(resolve(".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = new URL(
  env.DATABASE_URL.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, "postgresql://"),
);
url.searchParams.delete("schema");

const pool = new Pool({
  connectionString: url.toString(),
  ssl: env.DATABASE_SSL_CA
    ? {
        ca: readFileSync(resolve(env.DATABASE_SSL_CA), "utf8"),
        rejectUnauthorized: true,
      }
    : undefined,
});

try {
  if (action === "create") {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${disposableSchema}"`);
    console.log(`Created schema ${disposableSchema}`);
  } else {
    await pool.query(`DROP SCHEMA IF EXISTS "${disposableSchema}" CASCADE`);
    console.log(`Dropped schema ${disposableSchema}`);
  }
} finally {
  await pool.end();
}
