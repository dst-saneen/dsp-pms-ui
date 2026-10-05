import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleScope } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthorizationSnapshot,
  AvailableAuthorizationScope,
} from './auth.types';

type AssignmentWithAccess = Prisma.UserRoleAssignmentGetPayload<{
  include: {
    role: {
      include: {
        permissions: {
          include: {
            permission: true;
          };
        };
      };
    };
    companyGroup: {
      select: {
        id: true;
        groupName: true;
        companies: {
          select: {
            id: true;
            companyName: true;
          };
        };
      };
    };
    company: {
      select: {
        id: true;
        companyName: true;
        companyGroupId: true;
      };
    };
    branch: {
      select: {
        id: true;
        branchName: true;
        companyId: true;
      };
    };
  };
}>;

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSnapshot(
    userId: string,
    requestedCompanyId?: string,
    requestedBranchId?: string,
    requestedCompanyGroupId?: string,
  ): Promise<AuthorizationSnapshot> {
    const [user, assignments] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          defaultCompanyGroupId: true,
          defaultCompanyId: true,
          defaultBranchId: true,
        },
      }),
      this.loadAssignments(userId),
    ]);

    if (!user || assignments.length === 0) {
      throw new ForbiddenException('No active role assignment is available.');
    }

    const availableScopes = this.buildAvailableScopes(assignments);
    const hasGlobal = assignments.some(
      (assignment) => assignment.scope === RoleScope.GLOBAL,
    );
    const hasRequestedContext = Boolean(
      requestedCompanyGroupId || requestedCompanyId || requestedBranchId,
    );
    let activeCompanyGroupId = hasRequestedContext
      ? requestedCompanyGroupId
      : (user.defaultCompanyGroupId ?? undefined);
    let activeCompanyId = hasRequestedContext
      ? requestedCompanyId
      : (user.defaultCompanyId ?? undefined);
    let activeBranchId = hasRequestedContext
      ? requestedBranchId
      : (user.defaultBranchId ?? undefined);

    if (activeBranchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: activeBranchId },
        select: {
          id: true,
          companyId: true,
          company: {
            select: {
              companyGroupId: true,
            },
          },
        },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found.');
      }

      if (activeCompanyId && activeCompanyId !== branch.companyId) {
        throw new ForbiddenException(
          'The selected branch does not belong to the selected company.',
        );
      }

      activeCompanyId = branch.companyId;
      activeCompanyGroupId = this.assertMatchingCompanyGroup(
        activeCompanyGroupId,
        branch.company.companyGroupId,
      );
    } else if (activeCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: activeCompanyId },
        select: { companyGroupId: true },
      });

      if (!company) {
        throw new NotFoundException('Company not found.');
      }

      activeCompanyGroupId = this.assertMatchingCompanyGroup(
        activeCompanyGroupId,
        company.companyGroupId,
      );
    }

    if (!hasGlobal && !activeCompanyGroupId && !activeCompanyId) {
      if (availableScopes.length > 1) {
        throw new ConflictException({
          code: 'ORGANIZATION_SCOPE_SELECTION_REQUIRED',
          message: 'Select an organization scope to continue.',
          availableScopes,
        });
      }

      const [onlyScope] = availableScopes;
      activeCompanyGroupId = onlyScope?.companyGroupId;
      activeCompanyId = onlyScope?.companyId;
      activeBranchId = onlyScope?.branchId;
    }

    const effectiveAssignments = assignments.filter((assignment) => {
      switch (assignment.scope) {
        case RoleScope.GLOBAL:
          return true;
        case RoleScope.COMPANY_GROUP:
          return assignment.companyGroupId === activeCompanyGroupId;
        case RoleScope.COMPANY:
          return assignment.companyId === activeCompanyId;
        case RoleScope.BRANCH:
          return assignment.branchId === activeBranchId;
      }
    });

    if (effectiveAssignments.length === 0) {
      throw new ForbiddenException(
        'No role assignment permits the selected organization context.',
      );
    }

    const scopeLevel = this.resolveScopeLevel(effectiveAssignments);
    const permissions = new Set<string>();
    const roles = new Set<string>();

    for (const assignment of effectiveAssignments) {
      roles.add(assignment.role.code);

      for (const rolePermission of assignment.role.permissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return {
      roles: [...roles].sort(),
      permissions: [...permissions].sort(),
      scopeLevel,
      isGlobal: scopeLevel === RoleScope.GLOBAL,
      activeCompanyGroupId,
      activeCompanyId,
      activeBranchId,
      availableScopes,
    };
  }

  async getAvailableScopes(
    userId: string,
  ): Promise<AvailableAuthorizationScope[]> {
    return this.buildAvailableScopes(await this.loadAssignments(userId));
  }

  private loadAssignments(userId: string) {
    return this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        isActive: true,
        role: {
          isActive: true,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        companyGroup: {
          select: {
            id: true,
            groupName: true,
            companies: {
              where: { isActive: true },
              select: {
                id: true,
                companyName: true,
              },
              orderBy: { companyName: 'asc' },
            },
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
            companyGroupId: true,
          },
        },
        branch: {
          select: {
            id: true,
            branchName: true,
            companyId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private buildAvailableScopes(
    assignments: AssignmentWithAccess[],
  ): AvailableAuthorizationScope[] {
    const scopes = new Map<string, AvailableAuthorizationScope>();

    for (const assignment of assignments) {
      if (assignment.scope === RoleScope.GLOBAL) {
        scopes.set('GLOBAL', { scope: RoleScope.GLOBAL });
      } else if (
        assignment.scope === RoleScope.COMPANY_GROUP &&
        assignment.companyGroup
      ) {
        if (assignment.companyGroup.companies.length === 0) {
          scopes.set(assignment.scopeKey, {
            scope: RoleScope.COMPANY_GROUP,
            companyGroupId: assignment.companyGroup.id,
            companyGroupName: assignment.companyGroup.groupName,
          });
        }

        for (const company of assignment.companyGroup.companies) {
          scopes.set(`${assignment.scopeKey}:${company.id}`, {
            scope: RoleScope.COMPANY_GROUP,
            companyGroupId: assignment.companyGroup.id,
            companyGroupName: assignment.companyGroup.groupName,
            companyId: company.id,
            companyName: company.companyName,
          });
        }
      } else if (assignment.scope === RoleScope.COMPANY && assignment.company) {
        scopes.set(assignment.scopeKey, {
          scope: RoleScope.COMPANY,
          companyGroupId: assignment.company.companyGroupId ?? undefined,
          companyId: assignment.company.id,
          companyName: assignment.company.companyName,
        });
      } else if (
        assignment.scope === RoleScope.BRANCH &&
        assignment.company &&
        assignment.branch
      ) {
        scopes.set(assignment.scopeKey, {
          scope: RoleScope.BRANCH,
          companyGroupId: assignment.company.companyGroupId ?? undefined,
          companyId: assignment.company.id,
          companyName: assignment.company.companyName,
          branchId: assignment.branch.id,
          branchName: assignment.branch.branchName,
        });
      }
    }

    return [...scopes.values()].sort((left, right) =>
      [
        left.companyGroupName ?? '',
        left.companyName ?? '',
        left.branchName ?? '',
        left.companyGroupId ?? '',
        left.companyId ?? '',
        left.branchId ?? '',
      ]
        .join('\u0000')
        .localeCompare(
          [
            right.companyGroupName ?? '',
            right.companyName ?? '',
            right.branchName ?? '',
            right.companyGroupId ?? '',
            right.companyId ?? '',
            right.branchId ?? '',
          ].join('\u0000'),
        ),
    );
  }

  private resolveScopeLevel(assignments: AssignmentWithAccess[]): RoleScope {
    if (
      assignments.some((assignment) => assignment.scope === RoleScope.GLOBAL)
    ) {
      return RoleScope.GLOBAL;
    }

    if (
      assignments.some(
        (assignment) => assignment.scope === RoleScope.COMPANY_GROUP,
      )
    ) {
      return RoleScope.COMPANY_GROUP;
    }

    if (
      assignments.some((assignment) => assignment.scope === RoleScope.COMPANY)
    ) {
      return RoleScope.COMPANY;
    }

    return RoleScope.BRANCH;
  }

  private assertMatchingCompanyGroup(
    requestedCompanyGroupId: string | undefined,
    actualCompanyGroupId: string | null,
  ): string | undefined {
    if (
      requestedCompanyGroupId &&
      requestedCompanyGroupId !== actualCompanyGroupId
    ) {
      throw new ForbiddenException(
        'The selected company does not belong to the selected Company Group.',
      );
    }

    return actualCompanyGroupId ?? requestedCompanyGroupId;
  }
}
