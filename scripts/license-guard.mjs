/**
 * Phase D — quick license regression checks (no network).
 * Run from repo root or backend:
 *   node scripts/license-guard.mjs
 *   pnpm run license:guard   (from backend)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const compose = path.join(root, "docker-compose.yml");
const workspace = path.join(backend, "pnpm-workspace.yaml");
const lockfile = path.join(backend, "pnpm-lock.yaml");

let failed = 0;

function ok(msg) {
  console.log("OK  ", msg);
}
function bad(msg) {
  console.error("FAIL", msg);
  failed += 1;
}

// 1) Redis pin
const composeText = fs.readFileSync(compose, "utf8");
if (/image:\s*redis:7\.2\.\d+-alpine/.test(composeText)) {
  ok("docker-compose Redis pinned to 7.2.x-alpine");
} else if (/image:\s*redis:7-alpine/.test(composeText) || /image:\s*redis:7[^\d]/.test(composeText)) {
  bad("docker-compose uses floating redis:7 — pin redis:7.2.x-alpine (BSD)");
} else if (/image:\s*redis:/.test(composeText)) {
  bad("docker-compose Redis image is not the expected 7.2.x-alpine pin");
} else {
  bad("docker-compose Redis image line not found");
}

// 2) unzipper override
const wsText = fs.readFileSync(workspace, "utf8");
if (/exceljs>unzipper['"]?:\s*0\.12\./.test(wsText) || /'exceljs>unzipper':\s*0\.12\./.test(wsText)) {
  ok("pnpm-workspace.yaml overrides exceljs>unzipper to 0.12.x");
} else {
  bad("missing exceljs>unzipper → 0.12.x override in backend/pnpm-workspace.yaml");
}

// 3) buffers must not appear as a resolved package in lockfile (importers / packages)
const lockText = fs.readFileSync(lockfile, "utf8");
// pnpm lock entries look like:  buffers@0.1.1: or /buffers@0.1.1
const buffersHit = /(?:^|\s|\/)buffers@\d/m.test(lockText);
if (!buffersHit) {
  ok("backend pnpm-lock.yaml has no buffers@ package");
} else {
  bad("buffers@ still present in backend pnpm-lock.yaml — re-check exceljs/unzipper override");
}

// 4) live why (if pnpm available)
const why = spawnSync(
  "corepack",
  ["pnpm", "why", "buffers"],
  { cwd: backend, encoding: "utf8", shell: true },
);
const whyOut = `${why.stdout || ""}${why.stderr || ""}`.trim();
if (why.status === 0 && (!whyOut || !/buffers@/.test(whyOut))) {
  ok("pnpm why buffers → empty (not installed)");
} else if (/buffers@/.test(whyOut)) {
  bad("pnpm why buffers still lists a package:\n" + whyOut.slice(0, 500));
} else {
  ok("pnpm why buffers check skipped or empty");
}

console.log("");
if (failed) {
  console.error(`license-guard: ${failed} check(s) failed`);
  process.exit(1);
}
console.log("license-guard: all checks passed");
