#!/usr/bin/env node
/**
 * Pull-request secret scan. Fails if credential-shaped values appear in tracked files.
 * Does not print matched secret values.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PATTERNS = [
  { name: "AWS access key id", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "AWS secret-looking assignment",
    regex:
      /(SECRET_KEY|SECRET_ACCESS_KEY|AWS_SECRET)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40,}/i,
  },
  {
    name: "Private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "Known UAT password literal",
    // Assemble the signature so this scanner does not match its own source.
    regex: new RegExp(["FinanceApprover", "Uat1!"].join("")),
  },
  {
    name: "Retired UAT password literal",
    regex: new RegExp(["UatDevPass", "!2026"].join("")),
  },
];

const SKIP_PREFIXES = [
  "backend/dist/",
  "frontend/.next/",
  "node_modules/",
  "backend/node_modules/",
  "frontend/node_modules/",
];

const PLACEHOLDER_OK =
  /REPLACE_WITH_|your-private-bucket|example\.com|<32-byte/;

function resolveGitBinary() {
  const configured = process.env.GIT_BIN?.trim();
  if (configured) {
    return configured;
  }

  const windowsDefault = "C:\\Program Files\\Git\\cmd\\git.exe";
  return process.platform === "win32" && existsSync(windowsDefault)
    ? windowsDefault
    : "git";
}

const files = execFileSync(resolveGitBinary(), ["ls-files"], {
  encoding: "utf8",
})
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((file) => !SKIP_PREFIXES.some((prefix) => file.startsWith(prefix)));

const hits = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of PATTERNS) {
    const match = content.match(pattern.regex);
    if (match && !PLACEHOLDER_OK.test(match[0])) {
      hits.push({ file, name: pattern.name });
    }
  }
}

if (hits.length > 0) {
  console.error("Secret scan failed. Credential-shaped values found in:");
  for (const hit of hits) {
    console.error(`- ${hit.file} (${hit.name})`);
  }
  process.exit(1);
}

console.log("Secret scan clean.");
