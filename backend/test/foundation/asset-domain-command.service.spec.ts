import { ForbiddenException } from '@nestjs/common';
import { AssetKind, AssetTrackingMode } from '@prisma/client';

import { AssetCommandService } from '../../src/modules/asset-domain/asset-command.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';
import { DomainConflictException } from '../../src/common';

describe('AssetCommandService write guards', () => {
  const access = {
    canManageTaxonomy: jest.fn(),
    canManageInventory: jest.fn(),
    canLookupSensitiveCards: jest.fn(),
    assertCompanyWideTaxonomy: jest.fn(),
  };

  function createService() {
    return new AssetCommandService(
      {} as never,
      access as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  const readerContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSETS_READ],
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects type create with an illegal kind/tracking pair', async () => {
    access.canManageTaxonomy.mockReturnValue(true);
    const service = createService();

    await expect(
      service.createType(
        {
          companyId: 'company-a',
          assetCategoryId: 'cat-1',
          assetTypeName: 'Access card pool',
          kind: AssetKind.CARD,
          trackingMode: AssetTrackingMode.POOL,
        },
        readerContext,
      ),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
    });
  });

  it('forbids inventory create without manage permission', async () => {
    access.canManageInventory.mockReturnValue(false);
    const service = createService();

    await expect(
      service.createAsset(
        {
          companyId: 'company-a',
          departmentId: 'dept-1',
          assetTypeId: 'type-1',
          assetName: 'Laptop',
        },
        readerContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides card lookup when the actor lacks the protected permission', async () => {
    access.canLookupSensitiveCards.mockReturnValue(false);
    const service = createService();

    await expect(
      service.lookupCardExact(
        {
          cardNumber: '1234567890123456',
          purposeCode: 'INVENTORY_VERIFY',
        },
        readerContext,
      ),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_NOT_FOUND,
    });
  });

  it('uses DomainConflictException for invalid kind details', () => {
    expect(
      new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'invalid',
      ).code,
    ).toBe(ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID);
  });
});
