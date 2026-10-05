import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { referenceDataContractFingerprint } from './reference-data-contract';
import { createQaRunManifest } from './qa-run-manifest';

function resolveGitExecutable(): string {
  const configured = process.env.GIT_BIN?.trim();
  if (configured) {
    return configured;
  }

  const windowsDefault = 'C:\\Program Files\\Git\\cmd\\git.exe';
  return process.platform === 'win32' && existsSync(windowsDefault)
    ? windowsDefault
    : 'git';
}

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1]?.trim() ?? null) : null;
}

function main(): void {
  const suite = argumentValue('--suite');
  if (!suite) {
    throw new Error('Usage: pnpm qa:run:create -- --suite <suite-name>');
  }

  const gitCommit = execFileSync(
    resolveGitExecutable(),
    ['rev-parse', 'HEAD'],
    {
      cwd: resolve(process.cwd(), '..'),
      encoding: 'utf8',
    },
  ).trim();
  const manifest = createQaRunManifest({
    suite,
    gitCommit,
    contractFingerprint: referenceDataContractFingerprint(),
  });

  const outputDirectory = resolve(
    process.cwd(),
    process.env.QA_RUN_MANIFEST_DIR?.trim() || '.qa-runs',
  );
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, `${manifest.runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(outputPath);
}

main();
