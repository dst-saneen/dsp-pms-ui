import { CanActivate, Injectable } from '@nestjs/common';

import { ProjectsFeatureGateService } from '../services/projects-feature-gate.service';

/**
 * Blocks Project HTTP surfaces when no active Company is selected or its
 * CompanyModuleEntitlement does not include PROJECTS.
 */
@Injectable()
export class ProjectsEnabledGuard implements CanActivate {
  constructor(private readonly featureGate: ProjectsFeatureGateService) {}

  async canActivate(): Promise<boolean> {
    await this.featureGate.assertEnabledForContext();
    return true;
  }
}
