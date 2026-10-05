import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getOrganizationScope } from '../../../common';
import { Environment } from '../../../config';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';
import { RecruitmentShortlistGateService } from '../services/recruitment-shortlist-gate.service';

@Injectable()
export class RecruitmentEnabledGuard implements CanActivate {
  constructor(private readonly featureGate: RecruitmentFeatureGateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    const scope = getOrganizationScope();

    if (scope.isGlobal || !scope.activeCompanyId) {
      throw new ForbiddenException({
        code: RECRUITMENT_ERROR_CODES.RECRUITMENT_COMPANY_CONTEXT_REQUIRED,
        message: 'Select a Company to use Recruitment.',
      });
    }

    await this.featureGate.assertEnabledForCompany(scope.activeCompanyId);
    return true;
  }
}

@Injectable()
export class RecruitmentShortlistEnabledGuard implements CanActivate {
  constructor(
    private readonly shortlistGate: RecruitmentShortlistGateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    const scope = getOrganizationScope();

    if (
      scope.isGlobal ||
      !(await this.shortlistGate.isEnabledForCompany(scope.activeCompanyId))
    ) {
      throw new ForbiddenException({
        code: RECRUITMENT_ERROR_CODES.RECRUITMENT_SHORTLIST_MODULE_NOT_ENABLED,
        message: 'Shortlisting is not enabled for this Company.',
      });
    }

    return true;
  }
}

/**
 * Public exposure remains a deployment-wide safety switch. The controller
 * separately verifies the requested Company's Recruitment entitlement after
 * resolving its public company code.
 */
@Injectable()
export class PublicCareersEnabledGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  canActivate(): boolean {
    if (!this.configService.get('PUBLIC_CAREERS_ENABLED', { infer: true })) {
      throw new ForbiddenException({
        code: 'PUBLIC_CAREERS_DISABLED',
        message: 'Public careers is not enabled for this deployment.',
      });
    }

    return true;
  }
}
