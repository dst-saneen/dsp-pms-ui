import { Injectable } from '@nestjs/common';
import {
  Asset,
  AssetCategory,
  AssetType,
  DepartmentAssetGrant,
  EmployeeAsset,
  SoftwareLicenseAllocation,
} from '@prisma/client';

import type { AssetAccessContext } from './asset-access.types';
import { ASSET_PERMISSIONS } from './policies/asset-permissions';

export type AssetInventoryAction =
  'READ' | 'UPDATE_METADATA' | 'ASSIGN' | 'ARCHIVE' | 'TRANSFER';

export type TaxonomyAllowedAction = 'EDIT' | 'ARCHIVE' | 'REACTIVATE';

export type EmployeeAssetAllowedAction =
  | 'RETURN'
  | 'CLOSE_DAMAGED'
  | 'CLOSE_LOST'
  | 'ACKNOWLEDGE'
  | 'REQUEST_RETURN'
  | 'REPORT_DAMAGED'
  | 'REPORT_LOST';

export type LicenseAllocationAllowedAction =
  'REVOKE' | 'ACKNOWLEDGE' | 'REQUEST_LICENSE_REVOKE';

export type DepartmentGrantAllowedAction = 'REVOKE' | 'REACTIVATE' | 'REGRANT';

export type TransferAllowedAction = 'ACCEPT' | 'REJECT' | 'CANCEL' | 'FORCE';

export type WaiverAllowedAction = 'APPROVE' | 'REJECT' | 'CANCEL';

export interface SelfServiceCapabilityContext {
  isSelfService: boolean;
  canManageCustody?: boolean;
  /** Open SUBMITTED/IN_REVIEW custody request for this assignment/seat. */
  hasOpenRequest?: boolean;
}

@Injectable()
export class AssetCapabilityService {
  getInventoryAllowedActions(
    _asset: Pick<Asset, 'id' | 'isActive' | 'archivedAt' | 'departmentId'>,
    context: AssetAccessContext,
  ): AssetInventoryAction[] {
    const actions: AssetInventoryAction[] = ['READ'];

    const canManageBroad = this.hasPermission(
      context,
      ASSET_PERMISSIONS.ASSETS_MANAGE,
    );
    const canManageDepartment = this.hasPermission(
      context,
      ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
    );
    const canAssignBroad = this.hasPermission(
      context,
      ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE,
    );
    const canAssignDepartment = this.hasPermission(
      context,
      ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
    );

    if (canManageBroad || canManageDepartment) {
      actions.push('UPDATE_METADATA');
      actions.push('ARCHIVE');
      actions.push('TRANSFER');
    }

    if (canAssignBroad || canAssignDepartment) {
      actions.push('ASSIGN');
    }

    return [...new Set(actions)];
  }

  getCategoryAllowedActions(
    category: Pick<AssetCategory, 'archivedAt' | 'isActive'>,
    context: AssetAccessContext,
  ): TaxonomyAllowedAction[] {
    if (!this.canManageTaxonomy(context)) {
      return [];
    }

    if (category.archivedAt || !category.isActive) {
      return ['REACTIVATE'];
    }

    return ['EDIT', 'ARCHIVE'];
  }

  getTypeAllowedActions(
    assetType: Pick<AssetType, 'archivedAt' | 'isActive'>,
    context: AssetAccessContext,
  ): TaxonomyAllowedAction[] {
    if (!this.canManageTaxonomy(context)) {
      return [];
    }

    if (assetType.archivedAt || !assetType.isActive) {
      return ['REACTIVATE'];
    }

    return ['EDIT', 'ARCHIVE'];
  }

  getEmployeeAssetAllowedActions(
    assignment: Pick<
      EmployeeAsset,
      'acknowledgedAt' | 'returnedDate' | 'status'
    >,
    context: SelfServiceCapabilityContext,
  ): EmployeeAssetAllowedAction[] {
    const open =
      !assignment.returnedDate &&
      (assignment.status === 'ASSIGNED' || !assignment.status);
    if (!open) {
      return [];
    }

    const actions: EmployeeAssetAllowedAction[] = [];

    if (context.canManageCustody) {
      actions.push('RETURN', 'CLOSE_DAMAGED', 'CLOSE_LOST');
    }

    if (context.isSelfService) {
      if (!context.hasOpenRequest) {
        actions.push('REQUEST_RETURN', 'REPORT_DAMAGED', 'REPORT_LOST');
      }
      if (!assignment.acknowledgedAt) {
        actions.push('ACKNOWLEDGE');
      }
    }

    return [...new Set(actions)];
  }

  getLicenseAllocationAllowedActions(
    allocation: Pick<
      SoftwareLicenseAllocation,
      'acknowledgedAt' | 'status' | 'revokedAt'
    >,
    context: SelfServiceCapabilityContext,
  ): LicenseAllocationAllowedAction[] {
    if (allocation.status !== 'ACTIVE') {
      return [];
    }

    const actions: LicenseAllocationAllowedAction[] = [];

    if (context.canManageCustody) {
      actions.push('REVOKE');
    }

    if (context.isSelfService) {
      if (!context.hasOpenRequest) {
        actions.push('REQUEST_LICENSE_REVOKE');
      }
      if (!allocation.acknowledgedAt) {
        actions.push('ACKNOWLEDGE');
      }
    }

    return [...new Set(actions)];
  }

  getDepartmentGrantAllowedActions(
    grant: Pick<DepartmentAssetGrant, 'revokedAt'>,
    context: AssetAccessContext,
  ): DepartmentGrantAllowedAction[] {
    if (
      !this.hasPermission(context, ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
    ) {
      return [];
    }

    if (grant.revokedAt) {
      return ['REACTIVATE', 'REGRANT'];
    }

    return ['REVOKE'];
  }

  getTransferAllowedActions(
    transfer: {
      status: string;
      requestedByUserId: string;
      fromDepartmentId: string;
      toDepartmentId: string;
    },
    context: AssetAccessContext,
    grantedDepartmentIds: string[],
  ): TransferAllowedAction[] {
    if (transfer.status !== 'PENDING') {
      return [];
    }

    const actions: TransferAllowedAction[] = [];
    const isBroad =
      this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE) ||
      this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_READ);

    if (isBroad || grantedDepartmentIds.includes(transfer.toDepartmentId)) {
      actions.push('ACCEPT', 'REJECT');
    }

    if (
      transfer.requestedByUserId === context.userId ||
      this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE)
    ) {
      actions.push('CANCEL');
    }

    if (this.hasPermission(context, ASSET_PERMISSIONS.TRANSFERS_FORCE)) {
      actions.push('FORCE');
    }

    return [...new Set(actions)];
  }

  getWaiverAllowedActions(
    waiver: {
      status: string;
      requestedByUserId: string;
    },
    context: AssetAccessContext,
  ): WaiverAllowedAction[] {
    if (waiver.status !== 'REQUESTED') {
      return [];
    }

    const actions: WaiverAllowedAction[] = [];

    if (
      this.hasPermission(context, ASSET_PERMISSIONS.CLEARANCE_WAIVE) &&
      waiver.requestedByUserId !== context.userId
    ) {
      actions.push('APPROVE', 'REJECT');
    }

    if (
      waiver.requestedByUserId === context.userId ||
      this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE)
    ) {
      actions.push('CANCEL');
    }

    return [...new Set(actions)];
  }

  private canManageTaxonomy(context: AssetAccessContext): boolean {
    return this.hasPermission(context, ASSET_PERMISSIONS.ASSETS_MANAGE);
  }

  private hasPermission(context: AssetAccessContext, permission: string) {
    return (
      context.permissions.includes('platform.admin') ||
      context.permissions.includes(permission)
    );
  }
}
