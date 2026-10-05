import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });
process.env.ASSET_PG_TEST = '1';

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'jest',
    '--config',
    './test/jest-foundation.json',
    '--runInBand',
    '--testPathPatterns=asset-v2-pg.integration.spec.ts',
  ],
  { stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
