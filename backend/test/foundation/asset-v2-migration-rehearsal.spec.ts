import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ASSET_V2_INTEGRITY_QUERIES } from '../../src/modules/asset-domain/migration/asset-v2-integrity.queries';
import { mapLegacyAssetStatusToLifecycle } from '../../src/modules/asset-domain/migration/asset-v2-backfill.rules';

describe('Asset V2 migration rehearsal (plan §15)', () => {
  const expand = readFileSync(
    resolve(
      __dirname,
      '../../prisma/migrations/20260817150000_asset_v2_expand/migration.sql',
    ),
    'utf8',
  );
  const contract = readFileSync(
    resolve(
      __dirname,
      '../../prisma/migrations/20260817160000_asset_v2_contract_enforce/migration.sql',
    ),
    'utf8',
  );

  it('keeps expand additive and contract fail-closed', () => {
    expect(expand).toContain('ADD COLUMN IF NOT EXISTS "departmentId"');
    expect(contract).toContain('Asset V2 contract blocked');
    expect(contract).toContain('ALTER COLUMN "departmentId" SET NOT NULL');
  });

  it('proves the assignment unique index predicate changes at contract', () => {
    expect(expand).toContain(
      `WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL`,
    );
    expect(contract).toContain(
      'DROP INDEX IF EXISTS "employee_assets_one_active_assignment_per_asset_idx"',
    );
    expect(contract).toContain(
      `WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL`,
    );
  });

  it('maps every legacy status used in an upgrade rehearsal', () => {
    expect(mapLegacyAssetStatusToLifecycle('AVAILABLE')).toBe('ACTIVE');
    expect(mapLegacyAssetStatusToLifecycle('ASSIGNED')).toBe('ACTIVE');
    expect(mapLegacyAssetStatusToLifecycle('REPAIR')).toBe('IN_REPAIR');
    expect(mapLegacyAssetStatusToLifecycle('LOST')).toBe('LOST');
    expect(mapLegacyAssetStatusToLifecycle('DISPOSED')).toBe('DISPOSED');
    expect(mapLegacyAssetStatusToLifecycle('UNKNOWN')).toBeNull();
  });

  it('defines every §14 integrity query', () => {
    expect(ASSET_V2_INTEGRITY_QUERIES).toHaveLength(9);
  });
});
