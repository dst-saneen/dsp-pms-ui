import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, RoleScope } from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetDepartmentGrantQueryService } from './asset-department-grant-query.service';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  CreateDepartmentAssetGrantDto,
  VersionedDepartmentAssetGrantDto,
} from './dto/search-department-grant.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import { ASSET_DEPARTMENT_CUSTODIAN_ROLE } from './policies/asset-permissions';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class AssetDepartmentGrantCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly idempotency: AssetIdempotencyService,
    private readonly auditService: AuditService,
    private readonly grantQuery: AssetDepartmentGrantQueryService,
  ) {}

  async create(
    dto: CreateDepartmentAssetGrantDto,
    context: AssetAccessContext,
  ) {
    this.assertManage(context);
    const department = await this.organizationScope.assertDepartmentInScope(
      dto.departmentId,
    );
    const companyId = department.companyId;

    return this.idempotency.execute(
      context,
      companyId,
      'CREATE_DEPARTMENT_ASSET_GRANT',
      dto,
      async (tx) => {
        await this.assertUserInCompany(tx, dto.userId, companyId);
        const existing = await tx.departmentAssetGrant.findFirst({
          where: { userId: dto.userId, departmentId: dto.departmentId },
        });
        if (existing && !existing.revokedAt) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_ALREADY_ACTIVE,
            'This user already has an active grant for the department',
          );
        }
        if (existing?.revokedAt) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_REACTIVATION_REQUIRED,
            'Reactivate or regrant the existing department grant',
          );
        }

        const created = await tx.departmentAssetGrant.create({
          data: {
            companyId,
            branchId: department.branchId,
            departmentId: department.id,
            userId: dto.userId,
            grantedByUserId: context.userId,
            grantedAt: new Date(),
          },
        });

        await this.ensureDepartmentCustodianRole(
          tx,
          dto.userId,
          companyId,
          department.branchId,
        );

        await this.auditService.log(
          'DepartmentAssetGrant',
          created.id,
          'CREATE',
          null,
          {
            departmentId: department.id,
            userId: dto.userId,
            reason: dto.reason ?? null,
            custodianRoleEnsured: true,
          },
          { tx, userId: context.userId },
        );

        return this.idempotency.commandMeta(
          'DEPARTMENT_ASSET_GRANT',
          created.id,
        );
      },
      (id) => this.grantQuery.findGrantDetail(id, context),
    );
  }

  async reactivate(
    id: string,
    dto: VersionedDepartmentAssetGrantDto,
    context: AssetAccessContext,
  ) {
    return this.restore(id, dto, context, 'REACTIVATE_DEPARTMENT_ASSET_GRANT');
  }

  async regrant(
    id: string,
    dto: VersionedDepartmentAssetGrantDto,
    context: AssetAccessContext,
  ) {
    return this.restore(id, dto, context, 'REGRANT_DEPARTMENT_ASSET_GRANT');
  }

  async revoke(
    id: string,
    dto: VersionedDepartmentAssetGrantDto,
    context: AssetAccessContext,
  ) {
    this.assertManage(context);
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'REVOKE_DEPARTMENT_ASSET_GRANT',
      { id, ...dto },
      async (tx) => {
        const grant = await this.loadScopedGrant(tx, id);
        this.assertExpectedVersion(grant.version, dto.expectedVersion);
        if (grant.revokedAt) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_NOT_FOUND,
            'Department asset grant is already revoked',
          );
        }

        await tx.departmentAssetGrant.update({
          where: { id },
          data: {
            revokedAt: new Date(),
            revokedByUserId: context.userId,
            version: { increment: 1 },
          },
        });

        await this.auditService.log(
          'DepartmentAssetGrant',
          id,
          'REVOKE',
          grant,
          { revoked: true },
          { tx, userId: context.userId },
        );

        return this.idempotency.commandMeta('DEPARTMENT_ASSET_GRANT', id);
      },
      () => this.grantQuery.findGrantDetail(id, context),
    );
  }

  private restore(
    id: string,
    dto: VersionedDepartmentAssetGrantDto,
    context: AssetAccessContext,
    commandType: string,
  ) {
    this.assertManage(context);
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      commandType,
      { id, ...dto },
      async (tx) => {
        const grant = await this.loadScopedGrant(tx, id);
        this.assertExpectedVersion(grant.version, dto.expectedVersion);
        if (!grant.revokedAt) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_ALREADY_ACTIVE,
            'Department asset grant is already active',
          );
        }

        await tx.departmentAssetGrant.update({
          where: { id },
          data: {
            revokedAt: null,
            revokedByUserId: null,
            grantedByUserId: context.userId,
            grantedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.ensureDepartmentCustodianRole(
          tx,
          grant.userId,
          grant.companyId,
          grant.branchId,
        );

        await this.auditService.log(
          'DepartmentAssetGrant',
          id,
          commandType.startsWith('REGRANT') ? 'REGRANT' : 'REACTIVATE',
          grant,
          { active: true, custodianRoleEnsured: true },
          { tx, userId: context.userId },
        );

        return this.idempotency.commandMeta('DEPARTMENT_ASSET_GRANT', id);
      },
      () => this.grantQuery.findGrantDetail(id, context),
    );
  }

  private async loadScopedGrant(tx: DbClient, id: string) {
    const grant = await tx.departmentAssetGrant.findFirst({
      where: {
        id,
        ...this.organizationScopeToGrantWhere(),
      },
    });
    if (!grant) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_DEPARTMENT_GRANT_NOT_FOUND,
        'Department asset grant not found',
      );
    }
    await this.organizationScope.assertDepartmentInScope(grant.departmentId);
    return grant;
  }

  private organizationScopeToGrantWhere(): Prisma.DepartmentAssetGrantWhereInput {
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
    return where;
  }

  private async assertUserInCompany(
    tx: DbClient,
    userId: string,
    companyId: string,
  ) {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        OR: [{ employee: { companyId } }, { defaultCompanyId: companyId }],
      },
      select: { id: true },
    });
    if (!user) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'User not found in this company',
      );
    }
  }

  /**
   * Department grant scopes which departments a custodian may act on.
   * Permissions come from ASSET_DEPARTMENT_CUSTODIAN at **company** scope so
   * Custodian Inbox / assetNav appear on login even when the session has no
   * active branch (BRANCH-scoped roles are ignored in company-only context).
   */
  private async ensureDepartmentCustodianRole(
    tx: DbClient,
    userId: string,
    companyId: string,
    branchId: string | null,
  ) {
    const role = await tx.role.findFirst({
      where: {
        OR: [
          { id: ASSET_DEPARTMENT_CUSTODIAN_ROLE.id },
          { code: ASSET_DEPARTMENT_CUSTODIAN_ROLE.code },
        ],
        isActive: true,
      },
      select: { id: true },
    });
    if (!role) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset Department Custodian role is not seeded',
      );
    }

    const scope = branchId ? RoleScope.BRANCH : RoleScope.COMPANY;
    const scopeKey = branchId ? `BRANCH:${branchId}` : `COMPANY:${companyId}`;

    const existing = await tx.userRoleAssignment.findFirst({
      where: {
        userId,
        roleId: role.id,
        scope: RoleScope.COMPANY,
        companyId,
      },
      select: { id: true, isActive: true },
    });

    if (existing?.isActive) {
      return;
    }

    if (existing && !existing.isActive) {
      await tx.userRoleAssignment.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return;
    }

    await tx.userRoleAssignment.upsert({
      where: {
        userId_roleId_scopeKey: {
          userId,
          roleId: role.id,
          scopeKey,
        },
      },
      create: {
        userId,
        roleId: role.id,
        scope,
        scopeKey,
        companyId,
        branchId: branchId ?? undefined,
        isActive: true,
      },
      update: {
        isActive: true,
        scope,
        companyId,
        branchId: branchId ?? null,
      },
    });
  }

  private assertManage(context: AssetAccessContext) {
    if (!this.access.canManageDepartmentGrants(context)) {
      throw new ForbiddenException();
    }
  }

  private assertExpectedVersion(actual: number, expected?: number) {
    if (expected !== undefined && expected !== actual) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }
  }
}
