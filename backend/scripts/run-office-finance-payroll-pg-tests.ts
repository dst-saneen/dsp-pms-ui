import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required for Office Finance / Payroll PostgreSQL tests.',
  );
  process.exit(1);
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'jest',
    '--config',
    './test/jest-all.json',
    '--runInBand',
    '--testPathPatterns=office-finance-payroll-catalog|office-finance-payroll-concurrency',
  ],
  { stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
