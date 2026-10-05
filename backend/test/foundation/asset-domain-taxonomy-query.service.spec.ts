import { AssetTaxonomyQueryService } from '../../src/modules/asset-domain/asset-taxonomy-query.service';
import { SortOrder } from '../../src/common/enums';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetTaxonomyQueryService', () => {
  const access = {
    canReadTaxonomy: jest.fn().mockReturnValue(true),
  };
  const organizationScope = {
    assetCategoryWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
    assetTypeWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
  };
  const capabilities = {
    getCategoryAllowedActions: jest.fn().mockReturnValue(['EDIT']),
    getTypeAllowedActions: jest.fn().mockReturnValue(['EDIT']),
  };
  const mapper = {
    toCategoryResponse: jest.fn(
      (category: { id: string }, count: number, actions: string[]) => ({
        id: category.id,
        assetTypeCount: count,
        allowedActions: actions,
      }),
    ),
    toTypeResponse: jest.fn(),
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
    assetCategory: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'cat-1',
          _count: { assetTypes: 2 },
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn(),
    },
    assetType: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const context: AssetAccessContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSETS_READ],
    activeCompanyId: 'company-a',
  };

  function createService() {
    return new AssetTaxonomyQueryService(
      prisma as never,
      access as never,
      organizationScope as never,
      capabilities as never,
      mapper as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    access.canReadTaxonomy.mockReturnValue(true);
  });

  it('returns paginated categories with archive metadata and allowedActions', async () => {
    const service = createService();

    const result = await service.findCategoryPage(
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.ASC,
      },
      context,
    );

    expect(result).toEqual({
      items: [{ id: 'cat-1', assetTypeCount: 2, allowedActions: ['EDIT'] }],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it('returns empty taxonomy page when actor cannot read', async () => {
    access.canReadTaxonomy.mockReturnValue(false);
    const service = createService();

    const result = await service.findCategoryPage(
      {
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.ASC,
      },
      context,
    );

    expect(result.total).toBe(0);
    expect(prisma.assetCategory.findMany).not.toHaveBeenCalled();
  });
});
