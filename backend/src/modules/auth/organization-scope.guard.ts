import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthenticatedRequest } from './auth.types';
import { OrganizationScopeService } from './organization-scope.service';

@Injectable()
export class OrganizationScopeGuard implements CanActivate {
  constructor(private readonly organizationScope: OrganizationScopeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user || request.user.authorization.isGlobal) {
      return true;
    }

    const values = [
      request.params as Record<string, unknown>,
      request.query as Record<string, unknown>,
      (request.body ?? {}) as Record<string, unknown>,
    ];
    const companyGroupIds = this.collectIds(values, 'companyGroupId');
    const companyIds = this.collectIds(values, 'companyId');
    const branchIds = this.collectIds(values, 'branchId');

    for (const companyGroupId of companyGroupIds) {
      this.organizationScope.assertCompanyGroup(request.user, companyGroupId);
    }

    for (const companyId of companyIds) {
      await this.organizationScope.assertCompany(request.user, companyId);
    }

    for (const branchId of branchIds) {
      await this.organizationScope.assertBranch(request.user, branchId);
    }

    return true;
  }

  private collectIds(values: Record<string, unknown>[], key: string): string[] {
    const ids = new Set<string>();

    for (const value of values) {
      const candidate = value[key];

      if (typeof candidate === 'string' && candidate.length > 0) {
        ids.add(candidate);
      }
    }

    return [...ids];
  }
}
