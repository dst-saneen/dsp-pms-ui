import { Injectable } from '@nestjs/common';
import { RoleScope } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/auth.types';

import type { OnboardingActorContext } from '../contracts/onboarding-runtime.contracts';

@Injectable()
export class OnboardingActorContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: AuthenticatedUser): Promise<OnboardingActorContext> {
    const { authorization } = user;

    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId: user.id,
        isActive: true,
        role: {
          isActive: true,
        },
      },
      select: {
        scope: true,
        companyGroupId: true,
        companyId: true,
        branchId: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const employeeContext = await this.resolveEmployeeContext(user.employeeId);
    const assetGrants = await this.prisma.departmentAssetGrant.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        department: {
          isActive: true,
          branch: { isActive: true },
        },
      },
      select: { departmentId: true },
    });

    return {
      userId: user.id,
      isGlobal: authorization.isGlobal,
      permissions: authorization.permissions,
      assetGrantedDepartmentIds: [
        ...new Set(assetGrants.map((grant) => grant.departmentId)),
      ],
      organizationContext: {
        companyGroupId: authorization.activeCompanyGroupId,
        companyId: authorization.activeCompanyId,
        branchId: authorization.activeBranchId,
      },
      employeeContext,
      roleAssignments: roleAssignments.map((assignment) => ({
        scope: this.mapRoleScope(assignment.scope),
        companyGroupId: assignment.companyGroupId ?? undefined,
        companyId: assignment.companyId ?? undefined,
        branchId: assignment.branchId ?? undefined,
      })),
    };
  }

  hasPermission(context: OnboardingActorContext, permission: string): boolean {
    return context.permissions.includes(permission);
  }

  private async resolveEmployeeContext(employeeId?: string) {
    if (!employeeId) {
      return null;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        isActive: true,
        user: {
          isNot: null,
          is: {
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
      },
    });

    if (!employee?.departmentId) {
      return null;
    }

    return {
      employeeId: employee.id,
      companyId: employee.companyId,
      branchId: employee.branchId,
      departmentId: employee.departmentId,
      isActive: true as const,
    };
  }

  private mapRoleScope(
    scope: RoleScope,
  ): OnboardingActorContext['roleAssignments'][number]['scope'] {
    switch (scope) {
      case RoleScope.GLOBAL:
        return 'GLOBAL';
      case RoleScope.COMPANY_GROUP:
        return 'GROUP';
      case RoleScope.COMPANY:
        return 'COMPANY';
      case RoleScope.BRANCH:
        return 'BRANCH';
      default:
        return 'COMPANY';
    }
  }
}
