import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { getOrganizationScope } from '../../../common';

import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { OfficeFinanceFeatureService } from '../services/office-finance-feature.service';

@Injectable()
export class OfficeFinanceFeatureGuard implements CanActivate {
  constructor(private readonly featureService: OfficeFinanceFeatureService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    const scope = getOrganizationScope();

    if (scope.isGlobal) {
      throw new ForbiddenException({
        code: FINANCE_ERROR_CODES.OFFICE_FINANCE_SCOPE_NOT_ENABLED,
        message: 'Select a Company to use Finance.',
      });
    }

    if (
      !(await this.featureService.isEnabledForCompany(scope.activeCompanyId))
    ) {
      throw new ForbiddenException({
        code: FINANCE_ERROR_CODES.OFFICE_FINANCE_SCOPE_NOT_ENABLED,
        message: 'Finance is not enabled for this Company.',
      });
    }

    return true;
  }
}
