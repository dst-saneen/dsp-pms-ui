import { AssetKind, AssetTrackingMode } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseAssetV2MappingFile } from '../../src/modules/asset-domain/migration/asset-v2-mapping.loader';
import {
  assertMappingDoesNotInventPlaceholders,
  assertNoUnknownStatuses,
  mapLegacyAssetStatusToLifecycle,
} from '../../src/modules/asset-domain/migration/asset-v2-backfill.rules';
import { ASSET_V2_PREFLIGHT_CHECKS } from '../../src/modules/asset-domain/migration/asset-v2-preflight.queries';
import { runAssetV2Preflight } from '../../src/modules/asset-domain/migration/asset-v2-preflight.service';
import { ASSET_V2_INTEGRITY_QUERIES } from '../../src/modules/asset-domain/migration/asset-v2-integrity.queries';
import { emptyAssetV2Mapping } from '../../src/modules/asset-domain/migration/asset-v2-mapping.loader';

describe('Asset V2 Section 8 preflight and mapping', () => {
  it('rejects card plaintext in the ops mapping file', () => {
    expect(() =>
      parseAssetV2MappingFile(
        {
          version: 1,
          departmentByAssetId: {},
          classificationByAssetTypeId: {},
          serialByAssetId: {},
          locationByAssetId: {},
          softwareByAssetId: {},
          archives: [],
          cardNumber: '4111111111111111',
        },
        'mapping.json',
      ),
    ).toThrow(/Forbidden mapping key/);
  });

  it('rejects illegal kind/tracking pairs in mapping', () => {
    expect(() =>
      parseAssetV2MappingFile(
        {
          version: 1,
          departmentByAssetId: {},
          classificationByAssetTypeId: {
            'type-1': {
              kind: AssetKind.HARDWARE,
              trackingMode: AssetTrackingMode.POOL,
            },
          },
          serialByAssetId: {},
          locationByAssetId: {},
          softwareByAssetId: {},
          archives: [],
        },
        'mapping.json',
      ),
    ).toThrow(/illegal kind\/tracking/);
  });

  it('computes a stable mapping checksum', () => {
    const payload = {
      version: 1 as const,
      departmentByAssetId: { 'asset-1': 'dept-1' },
      classificationByAssetTypeId: {
        'type-1': {
          kind: AssetKind.HARDWARE,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
        },
      },
      serialByAssetId: {},
      locationByAssetId: {},
      softwareByAssetId: {},
      archives: [],
    };
    const first = parseAssetV2MappingFile(payload, 'a.json');
    const second = parseAssetV2MappingFile(payload, 'b.json');
    expect(first.checksum).toBe(second.checksum);
    expect(first.expectedRowCount).toBe(2);
  });

  it('does not invent placeholder serials', () => {
    const mapping = emptyAssetV2Mapping();
    mapping.serialByAssetId['asset-1'] = 'PLACEHOLDER-1';
    expect(() => assertMappingDoesNotInventPlaceholders(mapping)).toThrow(
      /placeholder serials/,
    );
  });

  it('maps known legacy statuses and stops on unknown values', () => {
    expect(mapLegacyAssetStatusToLifecycle('ASSIGNED')).toBe('ACTIVE');
    expect(mapLegacyAssetStatusToLifecycle('REPAIR')).toBe('IN_REPAIR');
    expect(mapLegacyAssetStatusToLifecycle('mystery')).toBeNull();
    expect(() =>
      assertNoUnknownStatuses({
        assetStatuses: ['AVAILABLE', 'BROKEN'],
        custodyStatuses: ['ASSIGNED'],
      }),
    ).toThrow(/Unknown legacy status/);
  });

  it('reports missing department and unknown status from SQL checks', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (sql.includes('a."departmentId" IS NULL')) {
          return Promise.resolve([{ id: 'asset-missing-dept' }]);
        }
        if (sql.includes("a.status NOT IN ('AVAILABLE'")) {
          return Promise.resolve([{ id: 'asset-unknown-status' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const report = await runAssetV2Preflight(prisma, {
      databaseName: 'test',
      databaseSchema: 'public',
    });

    expect(report.exceptionCount).toBe(2);
    expect(report.findings.map((item) => item.code).sort()).toEqual([
      'ASSET_REQUIRES_DEPARTMENT',
      'UNKNOWN_ASSET_STATUS',
    ]);
    expect(JSON.stringify(report)).not.toMatch(/cardNumber|remarks|reason/i);
  });

  it('covers every §5.2 preflight class and every §14 integrity query', () => {
    expect(ASSET_V2_PREFLIGHT_CHECKS.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'ASSET_REQUIRES_DEPARTMENT',
        'TYPE_REQUIRES_KIND_TRACKING',
        'HARDWARE_MISSING_SERIAL',
        'UNKNOWN_ASSET_STATUS',
        'TERMINAL_CLEARANCE_LIVE_CUSTODY',
      ]),
    );
    expect(ASSET_V2_INTEGRITY_QUERIES.map((item) => item.name)).toEqual([
      'missing_invalid_ownership',
      'duplicate_active_physical_custody',
      'licence_capacity_drift',
      'terminal_employees_with_active_custody',
      'operational_state_violations',
      'classification_subtype_drift',
      'legacy_mirror_drift',
      'invalid_clearance_linkage',
      'invalid_waiver_approval',
    ]);
  });

  it('gates the contract migration until exceptions are cleared and replaces the assignment index', () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../prisma/migrations/20260817160000_asset_v2_contract_enforce/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('Asset V2 contract blocked');
    expect(sql).toContain(
      'LOCK TABLE "employee_assets" IN SHARE ROW EXCLUSIVE MODE',
    );
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "employee_assets_one_active_assignment_per_asset_idx"',
    );
    expect(sql).toContain(
      `WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL`,
    );
    expect(sql).toContain('asset_cross_branch_transfer_guard');
    expect(sql).toContain('employee_organization_custody_guard');
  });
});
