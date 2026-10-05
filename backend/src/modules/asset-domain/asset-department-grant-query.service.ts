import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCapabilityService } from './asset-capability.service';
import { AssetResponseMapper } from './asset-response.mapper';
import { SearchDepartmentAssetGrantDto } from './dto/search-department-grant.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

@Injectable()
export class AssetDepartmentGrantQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly capabilities: AssetCapabilityService,
    private readonly mapper: AssetResponseMapper,
  ) {}

  async findGrantPage(
    query: SearchDepartmentAssetGrantDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageDepartmentGrants(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where = this.buildGrantWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.departmentAssetGrant.findMany({
        where,
        include: this.grantInclude(),
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.departmentAssetGrant.count({ where }),
    ]);

    const items = rows.map((grant) =>
      this.mapper.toDepartmentGrantResponse(
        grant,
        this.capabilities.getDepartmentGrantAllowedActions(grant, context),
      ),
    );

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  async findMyGrantedDepartments(context: AssetAccessContext) {
    if (!this.access.hasAnyDepartmentAssetPermission(context)) {
      return [];
    }

    const grants = await this.prisma.departmentAssetGrant.findMany({
      where: {
        userId: context.userId,
        revokedAt: null,
        ...(context.activeCompanyId
          ? { companyId: context.activeCompanyId }
          : {}),
        ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}),
      },
      include: {
        department: {
          select: {
            id: true,
            departmentName: true,
            departmentCode: true,
            branch: {
              select: {
                id: true,
                branchName: true,
                company: { select: { id: true, companyName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ department: { departmentName: 'asc' } }],
    });

    return grants.map((grant) => ({
      id: grant.department.id,
      name: grant.department.departmentName,
      code: grant.department.departmentCode,
      branch: {
        id: grant.department.branch.id,
        name: grant.department.branch.branchName,
      },
      company: {
        id: grant.department.branch.company.id,
        name: grant.department.branch.company.companyName,
      },
      grantId: grant.id,
      grantedAt: grant.grantedAt.toISOString(),
    }));
  }

  async findGrantDetail(id: string, context: AssetAccessContext) {
    if (!this.access.canManageDepartmentGrants(context)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_NOT_FOUND,
        'Department asset grant not found',
      );
    }

    const grant = await this.prisma.departmentAssetGrant.findFirst({
      where: {
        id,
        ...this.buildGrantScopeWhere(),
      },
      include: this.grantInclude(),
    });

    if (!grant) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_NOT_FOUND,
        'Department asset grant not found',
      );
    }

    return this.mapper.toDepartmentGrantResponse(
      grant,
      this.capabilities.getDepartmentGrantAllowedActions(grant, context),
    );
  }

  /**
   * Users eligible to receive a department asset grant for the active company.
   * Gated by department-access.manage — does not require security.users.read.
   */
  async findEligibleGrantUsers(
    context: AssetAccessContext,
    departmentId?: string,
  ) {
    if (!this.access.canManageDepartmentGrants(context)) {
      return {
        items: [] as Array<{
          id: string;
          displayName: string | null;
          email: string | null;
          employeeCode: string | null;
        }>,
      };
    }

    let companyId = context.activeCompanyId ?? null;
    if (departmentId) {
      const department =
        await this.organizationScope.assertDepartmentInScope(departmentId);
      companyId = department.companyId;
    }
    if (!companyId) {
      return { items: [] };
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        employeeId: { not: null },
        OR: [
          { employee: { companyId, isActive: true } },
          { defaultCompanyId: companyId },
        ],
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      take: 200,
    });

    return {
      items: users.map((user) => {
        const employeeName = user.employee
          ? [user.employee.firstName, user.employee.lastName]
              .filter(Boolean)
              .join(' ')
          : null;
        return {
          id: user.id,
          displayName:
            user.displayName ||
            employeeName ||
            user.username ||
            user.email ||
            user.id,
          email: user.email,
          employeeCode: user.employee?.employeeCode ?? null,
        };
      }),
    };
  }

  private grantInclude() {
    return {
      user: { select: { id: true, displayName: true, email: true } },
      grantedByUser: { select: { id: true, displayName: true } },
      revokedByUser: { select: { id: true, displayName: true } },
      department: {
        select: {
          id: true,
          departmentName: true,
          branch: {
            select: {
              id: true,
              branchName: true,
              company: { select: { id: true, companyName: true } },
            },
          },
        },
      },
    } satisfies Prisma.DepartmentAssetGrantInclude;
  }

  private buildGrantWhere(
    query: SearchDepartmentAssetGrantDto,
  ): Prisma.DepartmentAssetGrantWhereInput {
    const where: Prisma.DepartmentAssetGrantWhereInput = {
      ...this.buildGrantScopeWhere(),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    if (!query.includeInactive) {
      where.revokedAt = null;
    }

    return where;
  }

  private buildGrantScopeWhere(): Prisma.DepartmentAssetGrantWhereInput {
    const orgWhere = this.organizationScope.assetWhere();
    if ('id' in orgWhere && orgWhere.id === '__no_scope__') {
      return { id: '__no_scope__' };
    }

    const where: Prisma.DepartmentAssetGrantWhereInput = {};
    if (typeof orgWhere.companyId === 'string') {
      where.companyId = orgWhere.companyId;
    }
    if (typeof orgWhere.branchId === 'string') {
      where.branchId = orgWhere.branchId;
    }
    if (orgWhere.company) {
      where.department = { company: orgWhere.company };
    }
    return where;
  }
}
