/**
 * Phase 3 wrapper — empty disposable schema rehearsal on the configured host.
 * Loads backend/.env, never prints the URL/password.
 * Creates isolated schema via leave-b0-disposable-validate.mjs apply, then drops it.
 *
 * Usage: node scripts/leave-b0-phase3-empty-rehearsal.mjs
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL missing from environment/.env");
  process.exit(1);
}

const normalized = raw.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, "postgresql://");
const url = new URL(normalized);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

console.log("Phase 3a empty disposable rehearsal");
console.log(`Host: ${url.hostname}`);
console.log(`Database name: ${dbName}`);
console.log("Mode: isolated schema (B0_ALLOW_SHARED_DEV=1); dsp_pms is not the migrate target");
console.log("Schema will be created, migrate deploy x2, verified, then dropped");

const startedAt = new Date().toISOString();
const result = spawnSync(
  "node",
  ["scripts/leave-b0-disposable-validate.mjs", "apply"],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      B0_VALIDATE_DATABASE_URL: normalized,
      B0_ALLOW_SHARED_DEV: "1",
      DATABASE_SSL_CA: process.env.DATABASE_SSL_CA || "certs/global-bundle.pem",
    },
    encoding: "utf8",
    shell: true,
  },
);

const finishedAt = new Date().toISOString();
const stdout = result.stdout || "";
const stderr = result.stderr || "";
process.stdout.write(stdout);
process.stderr.write(stderr);

const schemaMatch = stdout.match(/Created disposable schema (\w+)/);
const dropped = /Dropped disposable schema/.test(stdout);
const passed = result.status === 0 && /B0 disposable validation passed/.test(stdout);

const evidence = {
  phase: "3a-empty-disposable-rehearsal",
  startedAt,
  finishedAt,
  operator: process.env.USERNAME || process.env.USER || "unknown",
  host: url.hostname,
  databaseName: dbName,
  approach:
    "Same RDS host, B0_ALLOW_SHARED_DEV=1, isolated disposable schema then DROP CASCADE. dsp_pms untouched.",
  disposableSchema: schemaMatch?.[1] ?? null,
  schemaDropped: dropped,
  firstDeployOk: /First migrate deploy completed/.test(stdout),
  objectsVerified: /B0 objects verified on disposable schema/.test(stdout),
  secondDeployIdempotent: /Second migrate deploy completed/.test(stdout),
  overallPass: passed,
  exitCode: result.status,
  noteProductionShaped:
    "Phase 3b (production-shaped disposable copy) still needs a separately named disposable DB or approved snapshot restore. Not run in this step.",
};

const outPath = resolve(
  repoRoot,
  "docs/product/leave-policy-matrix-migration-phase3a-evidence.json",
);
writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`Wrote ${outPath}`);
console.log(`OVERALL_PASS=${passed}`);
process.exit(passed ? 0 : 1);
