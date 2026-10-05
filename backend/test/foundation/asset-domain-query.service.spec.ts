import { AssetQueryService } from '../../src/modules/asset-domain/asset-query.service';
import { SortOrder } from '../../src/common/enums';
import { SearchAssetInventoryDto } from '../../src/modules/asset-domain/dto/search-asset-inventory.dto';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetQueryService inventory pagination', () => {
  const access = {
    canReadInventory: jest.fn().mockReturnValue(true),
    canReadCustody: jest.fn().mockReturnValue(true),
    canManageCustody: jest.fn().mockReturnValue(true),
    buildAssetInventoryWhere: jest
      .fn()
      .mockResolvedValue({ companyId: 'company-a' }),
    buildCustodyAssetWhere: jest
      .fn()
      .mockResolvedValue({ companyId: 'company-a' }),
    assertAssetInventoryReadable: jest.fn(),
    canReadPrivateHistory: jest.fn().mockReturnValue(false),
  };
  const capabilities = {
    getInventoryAllowedActions: jest.fn().mockReturnValue(['READ', 'ASSIGN']),
  };
  const mapper = {
    toInventoryListItem: jest.fn(
      (asset: { id: string }, allowedActions: string[]) => ({
        id: asset.id,
        allowedActions,
      }),
    ),
    toInventoryDetail: jest.fn(),
    toHistoryEvent: jest.fn((event: { id: string; action: string }) => ({
      id: event.id,
      eventType: event.action,
    })),
    toPaginatedInventory: jest.fn(
      (items: unknown[], total: number, page: number, limit: number) => ({
        items,
        total,
        page,
        limit,
      }),
    ),
    toPaginatedSafeEmployees: jest.fn(
      (items: unknown[], total: number, page: number, limit: number) => ({
        items,
        total,
        page,
        limit,
      }),
    ),
  };

  const prisma = {
    asset: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'asset-1', employeeAssets: [] }]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn(),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    employeeSeparation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    assetDomainActionEvent: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'evt-1', action: 'ASSIGNED' }]),
      count: jest.fn().mockResolvedValue(1),
    },
  };

  const context: AssetAccessContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSETS_READ],
    activeCompanyId: 'company-a',
  };

  function createService() {
    return new AssetQueryService(
      prisma as never,
      access as never,
      capabilities as never,
      mapper as never,
      {
        employeeWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
        assertEmployeeInScope: jest.fn().mockResolvedValue({
          id: 'emp-1',
          isActive: true,
          employmentStatus: 'ACTIVE',
        }),
      } as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    access.canReadInventory.mockReturnValue(true);
  });

  it('returns paginated inventory with allowedActions', async () => {
    const service = createService();

    const result = await service.findInventoryPage(
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      context,
    );

    expect(result).toEqual({
      items: [{ id: 'asset-1', allowedActions: ['READ', 'ASSIGN'] }],
      total: 1,
      page: 1,
      limit: 10,
    });
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
  });

  it('returns empty page when actor cannot read inventory', async () => {
    access.canReadInventory.mockReturnValue(false);
    const service = createService();

    const result = await service.findInventoryPage(
      Object.assign(new SearchAssetInventoryDto(), {
        page: 2,
        limit: 5,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      }),
      context,
    );

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 2,
      limit: 5,
    });
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
  });

  it('returns paginated asset history after scope check', async () => {
    const service = createService();

    const result = await service.findInventoryHistory(
      'asset-1',
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      context,
    );

    expect(access.assertAssetInventoryReadable).toHaveBeenCalledWith(
      'asset-1',
      context,
    );
    expect(result).toEqual({
      items: [{ id: 'evt-1', eventType: 'ASSIGNED' }],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it('returns eligible employees scoped to the selected asset', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: 'pool-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      trackingMode: 'POOL',
    });
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        employeeCode: 'E001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        isActive: true,
        employmentStatus: 'ACTIVE',
        separations: [],
      },
    ]);
    mapper.toPaginatedSafeEmployees.mockReturnValue({
      items: [{ id: 'emp-1', code: 'E001', name: 'Ada Lovelace' }],
      total: 1,
      page: 1,
      limit: 10,
    });
    const service = createService();

    const result = await service.findEligibleEmployees(
      {
        assetId: 'pool-1',
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      context,
    );

    expect(result.items).toHaveLength(1);
    expect(prisma.employee.findMany).toHaveBeenCalled();
  });
});
