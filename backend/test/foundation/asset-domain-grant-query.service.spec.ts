import { AssetDepartmentGrantQueryService } from '../../src/modules/asset-domain/asset-department-grant-query.service';
import { SortOrder } from '../../src/common/enums';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetDepartmentGrantQueryService scope isolation', () => {
  const access = {
    canManageDepartmentGrants: jest.fn(),
    hasAnyDepartmentAssetPermission: jest.fn(),
  };
  const organizationScope = {
    assetWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
  };
  const capabilities = {
    getDepartmentGrantAllowedActions: jest.fn().mockReturnValue(['REVOKE']),
  };
  const mapper = {
    toDepartmentGrantResponse: jest.fn(
      (grant: { id: string }, actions: string[]) => ({
        id: grant.id,
        allowedActions: actions,
      }),
    ),
    toPaginatedInventory: jest.fn(
      (items: unknown[], total: number, page: number, limit: number) => ({
        items,
        total,
        page,
        limit,
      }),
    ),
  };

  const prisma = {
    departmentAssetGrant: {
      findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(
        (args) => {
          void args;
          return Promise.resolve([]);
        },
      ),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const managerContext: AssetAccessContext = {
    userId: 'admin-1',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE],
    activeCompanyId: 'company-a',
  };

  const departmentContext: AssetAccessContext = {
    userId: 'custodian-1',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
    activeCompanyId: 'company-a',
    activeBranchId: 'branch-a',
  };

  function createService() {
    return new AssetDepartmentGrantQueryService(
      prisma as never,
      access as never,
      organizationScope as never,
      capabilities as never,
      mapper as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty grant page without department-access.manage', async () => {
    access.canManageDepartmentGrants.mockReturnValue(false);
    const service = createService();

    const result = await service.findGrantPage(
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      departmentContext,
    );

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(prisma.departmentAssetGrant.findMany).not.toHaveBeenCalled();
  });

  it('lists active grants for managers', async () => {
    access.canManageDepartmentGrants.mockReturnValue(true);
    prisma.departmentAssetGrant.findMany.mockResolvedValue([{ id: 'grant-1' }]);
    prisma.departmentAssetGrant.count.mockResolvedValue(1);

    const service = createService();
    const result = await service.findGrantPage(
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      managerContext,
    );

    expect(result.items).toEqual([
      { id: 'grant-1', allowedActions: ['REVOKE'] },
    ]);
    const [findManyArg] = prisma.departmentAssetGrant.findMany.mock.calls;
    expect(findManyArg[0].where).toMatchObject({
      companyId: 'company-a',
      revokedAt: null,
    });
  });

  it('returns granted departments for department custodians', async () => {
    access.hasAnyDepartmentAssetPermission.mockReturnValue(true);
    prisma.departmentAssetGrant.findMany.mockResolvedValue([
      {
        id: 'grant-1',
        grantedAt: new Date('2026-01-01T00:00:00.000Z'),
        department: {
          id: 'dept-a',
          departmentName: 'IT',
          departmentCode: 'IT',
          branch: {
            id: 'branch-a',
            branchName: 'HQ',
            company: { id: 'company-a', companyName: 'Acme' },
          },
        },
      },
    ]);

    const service = createService();
    const result = await service.findMyGrantedDepartments(departmentContext);

    expect(result).toEqual([
      {
        id: 'dept-a',
        name: 'IT',
        code: 'IT',
        branch: { id: 'branch-a', name: 'HQ' },
        company: { id: 'company-a', name: 'Acme' },
        grantId: 'grant-1',
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
