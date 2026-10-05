import { Injectable } from '@nestjs/common';
import { RoleScope, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { DeliveryTenantSnapshot } from './delivery-recipient.types';

/**
 * Resolves HR/internal users with exact RoleAssignment scope matching.
 * Never uses a loose Company-or-Branch OR. GLOBAL is included only when
 * the event registry explicitly allows platform-operations events.
 */
@Injectable()
export class DeliveryHrRecipientService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUsers(input: {
    permissionCode: string;
    tenant: DeliveryTenantSnapshot;
    allowGlobal?: boolean;
    departmentId?: string;
  }) {
    const scopeFilter = this.buildExactScopeFilter(
      input.tenant,
      input.allowGlobal === true,
    );
    if (!scopeFilter) {
      return [];
    }

    const where: Prisma.UserWhereInput = {
      status: UserStatus.ACTIVE,
      roleAssignments: {
        some: {
          isActive: true,
          role: {
            permissions: {
              some: { permission: { code: input.permissionCode } },
            },
          },
          OR: scopeFilter,
        },
      },
      ...(input.departmentId
        ? {
            employee: {
              isActive: true,
              companyId: input.tenant.companyId ?? undefined,
              branchId: input.tenant.branchId ?? undefined,
              departmentId: input.departmentId,
            },
          }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        email: true,
        normalizedEmail: true,
        employee: { select: { id: true } },
      },
      take: 200,
    });

    return [...new Map(users.map((user) => [user.id, user] as const)).values()];
  }

  async resolveUserIds(input: {
    permissionCode: string;
    tenant: DeliveryTenantSnapshot;
    allowGlobal?: boolean;
    departmentId?: string;
  }): Promise<string[]> {
    return (await this.resolveUsers(input)).map((user) => user.id);
  }

  buildExactScopeFilter(
    tenant: DeliveryTenantSnapshot,
    allowGlobal: boolean,
  ): Prisma.UserRoleAssignmentWhereInput[] | null {
    const clauses: Prisma.UserRoleAssignmentWhereInput[] = [];

    if (tenant.companyGroupId) {
      clauses.push({
        scope: RoleScope.COMPANY_GROUP,
        companyGroupId: tenant.companyGroupId,
      });
    }
    if (tenant.companyId) {
      clauses.push({
        scope: RoleScope.COMPANY,
        companyId: tenant.companyId,
      });
    }
    if (tenant.branchId) {
      clauses.push({
        scope: RoleScope.BRANCH,
        branchId: tenant.branchId,
      });
    }
    if (allowGlobal) {
      clauses.push({ scope: RoleScope.GLOBAL });
    }

    return clauses.length > 0 ? clauses : null;
  }
}
