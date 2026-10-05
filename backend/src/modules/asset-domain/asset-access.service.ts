import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetFeatureGateService } from './asset-feature-gate.service';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import {
  ASSET_INVENTORY_READ_PERMISSIONS,
  ASSET_PERMISSIONS,
} from './policies/asset-permissions';
import type { AssetAccessContext } from './asset-access.types';

export interface AssetInventoryScopeFilters {
  departmentId?: string;
  branchId?: string;
}

@Injectable()
export class AssetAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly featureGate: AssetFeatureGateService,
  ) {}

  hasPermission(context: AssetAccessContext, permission: string): boolean {
    return (
      context.permissions.includes('platform.admin') ||
      context.permissions.includes(permission)
    );
  }

  hasBroadInventoryRead(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_READ);
  }

  hasDepartmentInventoryRead(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.DEPARTMENT_READ);
  }

  canReadInventory(context: AssetAccessContext): boolean {
    return this.canReadTaxonomy(context);
  }

  canReadTaxonomy(context: AssetAccessContext): boolean {
    if (
      this.hasBroadInventoryRead(context) ||
      this.canManageTaxonomy(context)
    ) {
      return true;
    }

    if (
      this.hasDepartmentInventoryRead(context) ||
      this.canManageInventoryDepartment(context)
    ) {
      return true;
    }

    return ASSET_INVENTORY_READ_PERMISSIONS.some((permission) =>
      this.hasPermission(context, permission),
    );
  }

  canManageDepartmentGrants(context: AssetAccessContext): boolean {
    return this.hasPermission(
      context,
      ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE,
    );
  }

  hasAnyDepartmentAssetPermission(context: AssetAccessContext): boolean {
    return [
      ASSET_PERMISSIONS.DEPARTMENT_READ,
      ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
      ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ,
      ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
    ].some((permission) => this.hasPermission(context, permission));
  }

  canReadPrivateHistory(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.PRIVATE_HISTORY_READ);
  }

  canManageTaxonomy(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE);
  }

  async assertAssetsEnabled(context: AssetAccessContext): Promise<void> {
    await this.featureGate.assertEnabled(context);
  }

  async assertCompanyWideTaxonomy(context: AssetAccessContext): Promise<void> {
    await this.assertAssetsEnabled(context);
  }

  async assertLicensePoolScope(context: AssetAccessContext): Promise<void> {
    await this.assertAssetsEnabled(context);
  }

  async assertTransferPair(input: {
    companyId: string;
    fromBranchId: string | null | undefined;
    toBranchId: string | null | undefined;
  }): Promise<void> {
    await this.featureGate.assertTransferPair(input);
  }

  canManageInventoryBroad(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE);
  }

  canManageInventoryDepartment(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.DEPARTMENT_MANAGE);
  }

  canManageInventory(context: AssetAccessContext): boolean {
    return (
      this.canManageInventoryBroad(context) ||
      this.canManageInventoryDepartment(context)
    );
  }

  canDisposeOrRetire(context: AssetAccessContext): boolean {
    return this.canManageInventoryBroad(context);
  }

  canForceTransfer(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.TRANSFERS_FORCE);
  }

  canWaiveClearance(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.CLEARANCE_WAIVE);
  }

  canReadClearance(context: AssetAccessContext): boolean {
    return (
      this.canReadCustody(context) ||
      this.hasPermission(context, 'hr.employees.manage')
    );
  }

  canLookupSensitiveCards(context: AssetAccessContext): boolean {
    return this.hasPermission(
      context,
      ASSET_PERMISSIONS.CARDS_SENSITIVE_LOOKUP,
    );
  }

  canReadCustody(context: AssetAccessContext): boolean {
    return (
      this.hasPermission(context, ASSET_PERMISSIONS.ASSIGNMENTS_READ) ||
      this.hasPermission(
        context,
        ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ,
      ) ||
      this.canManageCustody(context)
    );
  }

  canManageCustody(context: AssetAccessContext): boolean {
    return (
      this.hasPermission(context, ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE) ||
      this.hasPermission(
        context,
        ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
      )
    );
  }

  hasBroadCustodyManage(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE);
  }

  async buildCustodyAssetWhere(
    context: AssetAccessContext,
    mode: 'read' | 'manage',
  ): Promise<Prisma.AssetWhereInput> {
    const where: Prisma.AssetWhereInput = {
      ...this.organizationScope.assetWhere(),
    };

    const broad =
      mode === 'manage'
        ? this.hasBroadCustodyManage(context)
        : this.hasPermission(context, ASSET_PERMISSIONS.ASSIGNMENTS_READ);

    if (broad) {
      return where;
    }

    const departmentPermission =
      mode === 'manage'
        ? ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE
        : ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ;

    if (!this.hasPermission(context, departmentPermission)) {
      return { id: '__no_scope__' };
    }

    const grantedDepartmentIds =
      await this.getActiveGrantedDepartmentIds(context);
    where.departmentId = { in: grantedDepartmentIds };
    return where;
  }

  async buildAssetManageWhere(
    context: AssetAccessContext,
    filters: AssetInventoryScopeFilters = {},
  ): Promise<Prisma.AssetWhereInput> {
    const where: Prisma.AssetWhereInput = {
      ...this.organizationScope.assetWhere(),
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (this.canManageInventoryBroad(context)) {
      if (filters.departmentId) {
        where.departmentId = filters.departmentId;
      }

      return where;
    }

    if (this.canManageInventoryDepartment(context)) {
      const grantedDepartmentIds =
        await this.getActiveGrantedDepartmentIds(context);

      if (filters.departmentId) {
        if (!grantedDepartmentIds.includes(filters.departmentId)) {
          return { id: '__no_scope__' };
        }

        where.departmentId = filters.departmentId;
      } else {
        where.departmentId = { in: grantedDepartmentIds };
      }

      return where;
    }

    return { id: '__no_scope__' };
  }

  async assertAssetManageable(assetId: string, context: AssetAccessContext) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ...(await this.buildAssetManageWhere(context)),
      },
      select: {
        id: true,
        departmentId: true,
        companyId: true,
        version: true,
      },
    });

    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    return asset;
  }

  async assertDepartmentManageable(
    departmentId: string,
    context: AssetAccessContext,
  ) {
    if (this.canManageInventoryBroad(context)) {
      return;
    }

    if (!this.canManageInventoryDepartment(context)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_DEPARTMENT_NOT_FOUND,
        'Department not found',
      );
    }

    const grantedDepartmentIds =
      await this.getActiveGrantedDepartmentIds(context);

    if (!grantedDepartmentIds.includes(departmentId)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_DEPARTMENT_NOT_FOUND,
        'Department not found',
      );
    }
  }

  async getActiveGrantedDepartmentIds(
    context: AssetAccessContext,
  ): Promise<string[]> {
    const grants = await this.prisma.departmentAssetGrant.findMany({
      where: {
        userId: context.userId,
        revokedAt: null,
        ...(context.activeCompanyId
          ? { companyId: context.activeCompanyId }
          : {}),
        ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}),
      },
      select: { departmentId: true },
    });

    return grants.map((grant) => grant.departmentId);
  }

  async buildAssetInventoryWhere(
    context: AssetAccessContext,
    filters: AssetInventoryScopeFilters = {},
  ): Promise<Prisma.AssetWhereInput> {
    const where: Prisma.AssetWhereInput = {
      ...this.organizationScope.assetWhere(),
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (this.hasBroadInventoryRead(context)) {
      if (filters.departmentId) {
        where.departmentId = filters.departmentId;
      }

      return where;
    }

    if (this.hasDepartmentInventoryRead(context)) {
      const grantedDepartmentIds =
        await this.getActiveGrantedDepartmentIds(context);

      if (filters.departmentId) {
        if (!grantedDepartmentIds.includes(filters.departmentId)) {
          return { id: '__no_scope__' };
        }

        where.departmentId = filters.departmentId;
      } else {
        where.departmentId = { in: grantedDepartmentIds };
      }

      return where;
    }

    return { id: '__no_scope__' };
  }

  async buildClearanceItemWhere(
    context: AssetAccessContext,
    mode: 'read' | 'manage' = 'read',
  ): Promise<Prisma.AssetClearanceItemWhereInput> {
    const assetWhere = await this.buildCustodyAssetWhere(context, mode);
    if ('id' in assetWhere && assetWhere.id === '__no_scope__') {
      return { id: '__no_scope__' };
    }

    const org = this.organizationScope.assetWhere();
    const where: Prisma.AssetClearanceItemWhereInput = {};

    if (typeof org.companyId === 'string') {
      where.companyId = org.companyId;
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {};
    if (typeof org.branchId === 'string') {
      employeeWhere.branchId = org.branchId;
    }
    const companyGroupId =
      org.company &&
      typeof org.company === 'object' &&
      'companyGroupId' in org.company
        ? org.company.companyGroupId
        : undefined;
    if (typeof companyGroupId === 'string') {
      employeeWhere.company = { companyGroupId };
    }
    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere;
    }

    where.OR = [
      { employeeAsset: { asset: assetWhere } },
      { licenseAllocation: { asset: assetWhere } },
    ];

    return where;
  }

  async buildTransferWhere(
    context: AssetAccessContext,
  ): Promise<Prisma.AssetOwnershipTransferWhereInput> {
    const org = this.organizationScope.assetWhere();
    if ('id' in org && org.id === '__no_scope__') {
      return { id: '__no_scope__' };
    }

    const where: Prisma.AssetOwnershipTransferWhereInput = {};
    if (typeof org.companyId === 'string') {
      where.companyId = org.companyId;
    }
    if (typeof org.branchId === 'string') {
      where.OR = [{ fromBranchId: org.branchId }, { toBranchId: org.branchId }];
    }

    if (
      this.hasBroadInventoryRead(context) ||
      this.canManageInventoryBroad(context)
    ) {
      return where;
    }

    if (
      this.hasDepartmentInventoryRead(context) ||
      this.canManageInventoryDepartment(context)
    ) {
      const grantedDepartmentIds =
        await this.getActiveGrantedDepartmentIds(context);
      if (grantedDepartmentIds.length === 0) {
        return { id: '__no_scope__' };
      }

      const departmentScope: Prisma.AssetOwnershipTransferWhereInput = {
        OR: [
          { fromDepartmentId: { in: grantedDepartmentIds } },
          { toDepartmentId: { in: grantedDepartmentIds } },
        ],
      };

      if (where.OR) {
        return { AND: [where, departmentScope] };
      }

      return { ...where, ...departmentScope };
    }

    return { id: '__no_scope__' };
  }

  async assertAssetInventoryReadable(
    assetId: string,
    context: AssetAccessContext,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ...(await this.buildAssetInventoryWhere(context)),
      },
      select: { id: true },
    });

    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    return asset;
  }
}
