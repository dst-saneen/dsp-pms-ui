/**
 * Stage 10 — runtime parity compare alias (work order §22.1).
 * Delegates to Stage 5 shadow runner.
 *
 * Historical alias. Use the same flags with migration:calendar:shadow.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, 'business-calendar-stage5-shadow.ts');
const forwarded = process.argv.slice(2);
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', script, ...forwarded],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
