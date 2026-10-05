import { ForbiddenException } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';

function createService(enabledCompanyIds: string[] = []) {
  const enabled = new Set(enabledCompanyIds);
  const entitlements = {
    isEnabled: jest.fn(
      (companyId: string | null | undefined, module: CompanyModuleCode) =>
        Promise.resolve(
          module === CompanyModuleCode.ONBOARDING &&
            companyId != null &&
            enabled.has(companyId),
        ),
    ),
    hasAnyEnabled: jest.fn().mockResolvedValue(enabled.size > 0),
  };

  return {
    service: new OnboardingFeatureGateService(entitlements as never),
    entitlements,
  };
}

describe('OnboardingFeatureGateService', () => {
  it('allows an entitled Company regardless of the active Branch', async () => {
    const { service, entitlements } = createService(['company-1']);

    await expect(
      service.isEnabledForContext('company-1', 'branch-1'),
    ).resolves.toBe(true);
    await expect(
      service.isEnabledForContext('company-1', 'branch-2'),
    ).resolves.toBe(true);
    expect(entitlements.isEnabled).toHaveBeenCalledWith(
      'company-1',
      CompanyModuleCode.ONBOARDING,
    );
  });

  it('fails closed when the Company lacks an ONBOARDING entitlement', async () => {
    const { service } = createService(['company-1']);

    await expect(service.isEnabledForContext('company-2')).resolves.toBe(false);
    try {
      await service.assertEnabledForContext('company-2');
      throw new Error('Expected the Onboarding gate to reject the Company.');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'ONBOARDING_MODULE_NOT_ENABLED',
      });
    }
  });
});
