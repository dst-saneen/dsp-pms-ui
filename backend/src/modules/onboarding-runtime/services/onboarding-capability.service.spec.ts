import { OnboardingCapabilityService } from './onboarding-capability.service';
import { OnboardingProgressService } from './onboarding-progress.service';
import { OnboardingAssetFulfillmentService } from './onboarding-asset-fulfillment.service';

describe('OnboardingCapabilityService', () => {
  const assetFulfillment = {
    isAvailable: jest.fn().mockReturnValue(false),
  } as unknown as OnboardingAssetFulfillmentService;

  const service = new OnboardingCapabilityService(
    new OnboardingProgressService(),
    assetFulfillment,
  );

  it('returns empty actions for LEGACY_V1 onboarding', () => {
    const result = service.calculateOnboardingActions(
      {
        userId: 'user-1',
        isGlobal: false,
        permissions: ['hr.onboarding.manage'],
        organizationContext: { companyId: 'company-1' },
        employeeContext: null,
        roleAssignments: [],
        assetGrantedDepartmentIds: [],
      },
      {
        id: 'onboarding-1',
        contractVersion: 'LEGACY_V1',
        status: 'IN_PROGRESS',
        companyId: 'company-1',
        branchId: 'branch-1',
      },
      [],
    );

    expect(result.allowedActions).toEqual([]);
  });
});
