import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../../auth/auth.types';

import { OnboardingFeatureGateService } from '../services/onboarding-feature-gate.service';

/**
 * Blocks every authenticated onboarding HTTP surface unless the selected
 * Company has explicitly enabled the ONBOARDING product module.  Record-ID
 * handlers still resolve the record through the tenant scope service before
 * checking its Company entitlement; this guard protects collection routes and
 * prevents compatibility endpoints from becoming a disabled-module fallback.
 */
@Injectable()
export class OnboardingEnabledGuard implements CanActivate {
  constructor(private readonly featureGate: OnboardingFeatureGateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.user?.authorization;

    await this.featureGate.assertEnabledForContext(
      authorization?.activeCompanyId,
      authorization?.activeBranchId,
    );

    return true;
  }
}
