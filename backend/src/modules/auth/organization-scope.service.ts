import { Injectable, NotFoundException } from '@nestjs/common';

import { getOrganizationScope } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class OrganizationScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCompany(
    user: AuthenticatedUser,
    companyId: string,
  ): Promise<void> {
    await this.assertCompanyForScope(user.authorization, companyId);
  }

  assertCompanyGroup(user: AuthenticatedUser, companyGroupId: string): void {
    if (user.authorization.isGlobal) {
      return;
    }

    if (user.authorization.activeCompanyGroupId !== companyGroupId) {
      throw this.notFound();
    }
  }

  async assertBranch(user: AuthenticatedUser, branchId: string): Promise<void> {
    await this.assertBranchForScope(user.authorization, branchId);
  }

  current() {
    return getOrganizationScope();
  }

  companyGroupIdOrUndefined(): string | undefined {
    const scope = this.current();
    return scope.isGlobal ? undefined : scope.activeCompanyGroupId;
  }

  companyIdOrUndefined(): string | undefined {
    const scope = this.current();
    return scope.isGlobal ? undefined : scope.activeCompanyId;
  }

  branchIdOrUndefined(): string | undefined {
    const scope = this.current();
    return scope.isGlobal ? undefined : scope.activeBranchId;
  }

  assertCurrentCompanyGroup(companyGroupId: string): void {
    const scope = this.current();

    if (!scope.isGlobal && scope.activeCompanyGroupId !== companyGroupId) {
      throw this.notFound();
    }
  }

  async assertCurrentCompany(companyId: string): Promise<void> {
    await this.assertCompanyForScope(this.current(), companyId);
  }

  async assertCurrentBranch(branchId: string): Promise<void> {
    await this.assertBranchForScope(this.current(), branchId);
  }

  private async assertCompanyForScope(
    scope: {
      isGlobal?: boolean;
      scopeLevel?: string;
      activeCompanyGroupId?: string;
      activeCompanyId?: string;
    },
    companyId: string,
  ): Promise<void> {
    if (scope.isGlobal) {
      return;
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      const company = await this.prisma.company.findFirst({
        where: {
          id: companyId,
          companyGroupId: scope.activeCompanyGroupId,
        },
        select: { id: true },
      });

      if (company) {
        return;
      }
    } else if (scope.activeCompanyId === companyId) {
      return;
    }

    throw this.notFound();
  }

  private async assertBranchForScope(
    scope: {
      isGlobal?: boolean;
      scopeLevel?: string;
      activeCompanyGroupId?: string;
      activeCompanyId?: string;
      activeBranchId?: string;
    },
    branchId: string,
  ): Promise<void> {
    if (scope.isGlobal) {
      return;
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        companyId: true,
        company: {
          select: {
            companyGroupId: true,
          },
        },
      },
    });

    const allowed =
      branch &&
      (scope.scopeLevel === 'COMPANY_GROUP'
        ? branch.company.companyGroupId === scope.activeCompanyGroupId
        : branch.companyId === scope.activeCompanyId &&
          (!scope.activeBranchId || scope.activeBranchId === branchId));

    if (!allowed) {
      throw this.notFound();
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException('The requested record was not found.');
  }
}
