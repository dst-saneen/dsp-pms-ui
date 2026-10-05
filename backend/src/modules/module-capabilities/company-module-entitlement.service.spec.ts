import { CompanyModuleCode } from '@prisma/client';

import { CompanyModuleEntitlementService } from './company-module-entitlement.service';

describe('CompanyModuleEntitlementService', () => {
  it('queries enabled rows for an active Company and returns the canonical codes', async () => {
    const prisma = {
      companyModuleEntitlement: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { module: CompanyModuleCode.FINANCE },
            { module: CompanyModuleCode.PROJECTS },
          ]),
      },
    };
    const service = new CompanyModuleEntitlementService(prisma as never);

    await expect(service.getEnabledModules('company-1')).resolves.toEqual(
      new Set([CompanyModuleCode.FINANCE, CompanyModuleCode.PROJECTS]),
    );
    expect(prisma.companyModuleEntitlement.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        isEnabled: true,
        company: { isActive: true },
      },
      select: { module: true },
    });
  });

  it('fails closed without a Company context', async () => {
    const prisma = {
      companyModuleEntitlement: { findMany: jest.fn() },
    };
    const service = new CompanyModuleEntitlementService(prisma as never);

    await expect(service.getEnabledModules(null)).resolves.toEqual(new Set());
    expect(prisma.companyModuleEntitlement.findMany).not.toHaveBeenCalled();
  });
});
