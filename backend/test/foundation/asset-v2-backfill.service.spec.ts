import { AssetKind, AssetTrackingMode } from '@prisma/client';

import { runAssetV2Backfill } from '../../src/modules/asset-domain/migration/asset-v2-backfill.service';
import { parseAssetV2MappingFile } from '../../src/modules/asset-domain/migration/asset-v2-mapping.loader';
import { mapLegacyAssetStatusToLifecycle } from '../../src/modules/asset-domain/migration/asset-v2-backfill.rules';

describe('Asset V2 Section 8 backfill', () => {
  it('is idempotent for the lifecycle mapping table', () => {
    expect(mapLegacyAssetStatusToLifecycle('AVAILABLE')).toBe('ACTIVE');
    expect(mapLegacyAssetStatusToLifecycle('ASSIGNED')).toBe('ACTIVE');
    expect(mapLegacyAssetStatusToLifecycle('REPAIR')).toBe('IN_REPAIR');
    expect(mapLegacyAssetStatusToLifecycle('DISPOSED')).toBe('DISPOSED');
    expect(mapLegacyAssetStatusToLifecycle('REPAIR')).toBe(
      mapLegacyAssetStatusToLifecycle('REPAIR'),
    );
  });

  it('stops apply when unknown legacy asset status rows exist', async () => {
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          asset: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ id: 'a1', status: 'BROKEN' }]),
          },
          employeeAsset: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        }),
      ),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    await expect(
      runAssetV2Backfill(prisma as never, {
        apply: true,
        databaseName: 'test',
        databaseSchema: 'public',
      }),
    ).rejects.toThrow(/Unknown legacy status/);
  });

  it('does not invent serials when mapping omits them', () => {
    const loaded = parseAssetV2MappingFile(
      {
        version: 1,
        departmentByAssetId: {},
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
      },
      'mapping.json',
    );
    expect(loaded.mapping.serialByAssetId).toEqual({});
  });
});
