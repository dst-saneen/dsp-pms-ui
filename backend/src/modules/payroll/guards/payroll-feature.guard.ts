import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { getOrganizationScope } from '../../../common';

import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PayrollFeatureService } from '../services/payroll-feature.service';

/**
 * Gates Payroll APIs on Company module entitlement only.
 * Full finance, file-storage, and period readiness is enforced by preflight
 * when creating or calculating runs—not on setup tabs such as components and salaries.
 */
@Injectable()
export class PayrollFeatureGuard implements CanActivate {
  constructor(private readonly featureService: PayrollFeatureService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    const scope = getOrganizationScope();

    if (scope.isGlobal || !scope.activeCompanyId) {
      throw new ForbiddenException({
        code: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        message: 'Select a Company to use Payroll.',
      });
    }

    if (
      !(await this.featureService.isEnabledForCompany(scope.activeCompanyId))
    ) {
      throw new ForbiddenException({
        code: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        message: 'Payroll is not enabled for this Company.',
      });
    }

    return true;
  }
}
