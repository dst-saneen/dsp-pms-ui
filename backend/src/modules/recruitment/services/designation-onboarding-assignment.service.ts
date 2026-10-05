import { Injectable } from '@nestjs/common';

import { OnboardingTemplateResolutionService } from '../../onboarding-runtime/services/onboarding-template-resolution.service';

export type { ResolvedOnboardingTemplate } from '../../onboarding-runtime/contracts/onboarding-runtime.contracts';

@Injectable()
export class DesignationOnboardingAssignmentService {
  constructor(
    private readonly templateResolution: OnboardingTemplateResolutionService,
  ) {}

  resolve(
    companyId: string,
    branchId: string,
    designationId: string,
    asOf: Date = new Date(),
  ) {
    return this.templateResolution.resolve(
      companyId,
      branchId,
      designationId,
      asOf,
    );
  }

  resolvePublishedTemplateVersion(
    companyId: string,
    branchId: string,
    designationId: string,
    asOf: Date = new Date(),
  ) {
    return this.templateResolution.resolvePublishedTemplateVersion(
      companyId,
      branchId,
      designationId,
      asOf,
    );
  }
}
