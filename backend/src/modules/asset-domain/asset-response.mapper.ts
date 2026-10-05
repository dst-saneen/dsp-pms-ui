import { Injectable } from '@nestjs/common';
import {
  Asset,
  AssetCategory,
  AssetDomainActionEvent,
  AssetType,
  DepartmentAssetGrant,
  EmployeeAsset,
  Prisma,
  SoftwareLicenseAllocation,
} from '@prisma/client';

import type { PaginatedResponse } from './dto/asset-api.types';
import type {
  AssetInventoryAction,
  DepartmentGrantAllowedAction,
  EmployeeAssetAllowedAction,
  LicenseAllocationAllowedAction,
  TaxonomyAllowedAction,
  TransferAllowedAction,
  WaiverAllowedAction,
} from './asset-capability.service';
import { ASSET_INVENTORY_LIST_INCLUDE } from './asset-domain.constants';

type AssetInventoryRecord = Prisma.AssetGetPayload<{
  include: typeof ASSET_INVENTORY_LIST_INCLUDE;
}>;

type CategoryRecord = AssetCategory & {
  company: { id: string; companyName: string };
};

type TypeRecord = AssetType & {
  company: { id: string; companyName: string };
  assetCategory: { id: string; assetCategoryName: string };
};

type GrantRecord = DepartmentAssetGrant & {
  user: { id: string; displayName: string | null; email: string | null };
  grantedByUser: { id: string; displayName: string | null };
  revokedByUser: { id: string; displayName: string | null } | null;
  department: {
    id: string;
    departmentName: string;
    branch: {
      id: string;
      branchName: string;
      company: { id: string; companyName: string };
    };
  };
};

type EmployeeAssetRecord = EmployeeAsset & {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
    branchId: string | null;
    departmentId: string | null;
  };
  assignedByUser: { id: string; displayName: string | null } | null;
  closedByUser: { id: string; displayName: string | null } | null;
  asset: {
    id: string;
    assetCode: string;
    assetName: string;
    version: number;
    kind: Asset['kind'];
    trackingMode: Asset['trackingMode'];
    lifecycleStatus: Asset['lifecycleStatus'];
    status: string;
    warrantyExpiry: Date | null;
    company: { id: string; companyName: string };
    branch: { id: string; branchName: string } | null;
    department: { id: string; departmentName: string } | null;
    assetType: {
      id: string;
      assetTypeName: string;
      kind: Asset['kind'];
      trackingMode: Asset['trackingMode'];
    };
  };
};

type LicenseAllocationRecord = SoftwareLicenseAllocation & {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
  };
  allocatedByUser: { id: string; displayName: string | null };
  revokedByUser: { id: string; displayName: string | null } | null;
  asset: {
    id: string;
    assetCode: string;
    assetName: string;
    version: number;
    kind: Asset['kind'];
    trackingMode: Asset['trackingMode'];
    lifecycleStatus: Asset['lifecycleStatus'];
    status: string;
    warrantyExpiry: Date | null;
    company: { id: string; companyName: string };
    branch: { id: string; branchName: string } | null;
    department: { id: string; departmentName: string } | null;
    assetType: {
      id: string;
      assetTypeName: string;
      kind: Asset['kind'];
      trackingMode: Asset['trackingMode'];
    };
    softwareLicenseDetail: {
      seatCapacity: number;
      expiresOn: Date | null;
    } | null;
  };
};

export interface AssetInventoryListItem {
  id: string;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  assetTypeId: string;
  assetCode: string;
  assetName: string;
  kind: Asset['kind'];
  trackingMode: Asset['trackingMode'];
  lifecycleStatus: Asset['lifecycleStatus'];
  status: string;
  isActive: boolean;
  version: number;
  serialNumber: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  purchaseDate: Date | null;
  purchaseCost: Asset['purchaseCost'];
  currency: string | null;
  warrantyExpiry: Date | null;
  location: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  allowedActions: AssetInventoryAction[];
  company?: AssetInventoryRecord['company'];
  branch?: AssetInventoryRecord['branch'];
  department?: AssetInventoryRecord['department'];
  assetType?: AssetInventoryRecord['assetType'];
  employeeAssets?: AssetInventoryRecord['employeeAssets'];
  activeAssignment?: AssetInventoryRecord['employeeAssets'][number];
  softwareLicenseDetail?: {
    seatCapacity: number;
    vendorName?: string | null;
    productName?: string | null;
    expiresOn?: Date | null;
  } | null;
}

@Injectable()
export class AssetResponseMapper {
  toInventoryListItem(
    asset: AssetInventoryRecord,
    allowedActions: AssetInventoryAction[],
  ): AssetInventoryListItem {
    const [activeAssignment] = asset.employeeAssets;

    return {
      id: asset.id,
      companyId: asset.companyId,
      branchId: asset.branchId,
      departmentId: asset.departmentId,
      assetTypeId: asset.assetTypeId,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      kind: asset.kind,
      trackingMode: asset.trackingMode,
      lifecycleStatus: asset.lifecycleStatus,
      status: asset.status,
      isActive: asset.isActive,
      version: asset.version,
      serialNumber: asset.serialNumber,
      manufacturer: asset.manufacturer,
      modelNumber: asset.modelNumber,
      purchaseDate: asset.purchaseDate,
      purchaseCost: asset.purchaseCost,
      currency: asset.currency,
      warrantyExpiry: asset.warrantyExpiry,
      location: asset.location,
      remarks: asset.remarks,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      allowedActions,
      company: asset.company,
      branch: asset.branch,
      department: asset.department,
      assetType: asset.assetType,
      employeeAssets: asset.employeeAssets,
      activeAssignment,
      softwareLicenseDetail: asset.softwareLicenseDetail
        ? {
            seatCapacity: asset.softwareLicenseDetail.seatCapacity,
            vendorName: asset.softwareLicenseDetail.vendorName,
            productName: asset.softwareLicenseDetail.productName,
            expiresOn: asset.softwareLicenseDetail.expiresOn,
          }
        : null,
    };
  }

  toInventoryDetail(
    asset: AssetInventoryRecord,
    allowedActions: AssetInventoryAction[],
  ): AssetInventoryListItem {
    return this.toInventoryListItem(asset, allowedActions);
  }

  toCategoryResponse(
    category: CategoryRecord,
    assetTypeCount: number,
    allowedActions: TaxonomyAllowedAction[],
  ) {
    return {
      id: category.id,
      company: {
        id: category.company.id,
        name: category.company.companyName,
      },
      assetCategoryCode: category.assetCategoryCode,
      assetCategoryName: category.assetCategoryName,
      description: category.description ?? undefined,
      version: category.version,
      archived: Boolean(category.archivedAt) || !category.isActive,
      assetTypeCount,
      allowedActions,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  toTypeResponse(
    assetType: TypeRecord,
    assetCount: number,
    allowedActions: TaxonomyAllowedAction[],
  ) {
    return {
      id: assetType.id,
      company: {
        id: assetType.company.id,
        name: assetType.company.companyName,
      },
      category: {
        id: assetType.assetCategory.id,
        name: assetType.assetCategory.assetCategoryName,
      },
      assetTypeCode: assetType.assetTypeCode,
      assetTypeName: assetType.assetTypeName,
      description: assetType.description ?? undefined,
      kind: assetType.kind,
      trackingMode: assetType.trackingMode,
      version: assetType.version,
      archived: Boolean(assetType.archivedAt) || !assetType.isActive,
      assetCount,
      classificationMutable: assetCount === 0,
      allowedActions,
      createdAt: assetType.createdAt.toISOString(),
      updatedAt: assetType.updatedAt.toISOString(),
    };
  }

  toHistoryEvent(
    event: AssetDomainActionEvent & {
      actorUser: { id: string; displayName: string | null };
    },
    includePrivate: boolean,
  ) {
    return {
      id: event.id,
      eventType: event.action,
      occurredAt: event.createdAt.toISOString(),
      actor: event.actorUser
        ? {
            id: event.actorUser.id,
            name: event.actorUser.displayName ?? 'Unknown',
          }
        : undefined,
      effectiveDate: event.effectiveDate?.toISOString().slice(0, 10),
      versionBefore: event.versionBefore,
      versionAfter: event.versionAfter,
      ...(includePrivate && (event.privateReason || event.privateNote)
        ? {
            actionContext: {
              reason: event.privateReason ?? undefined,
              note: event.privateNote ?? undefined,
            },
          }
        : {}),
    };
  }

  toEmployeeAssetResponse(
    assignment: EmployeeAssetRecord,
    allowedActions: EmployeeAssetAllowedAction[],
  ) {
    return {
      id: assignment.id,
      version: assignment.version ?? 1,
      custodyStatus: assignment.custodyStatus ?? assignment.status,
      employee: this.toSafeEmployeeReference(assignment.employee),
      asset: this.toAssetSummary(assignment.asset, []),
      assignedDate: assignment.assignedDate.toISOString().slice(0, 10),
      assignedBy: assignment.assignedByUser
        ? this.toSafeUserReference(assignment.assignedByUser)
        : undefined,
      branchAtAssignment: assignment.branchIdAtAssignment
        ? { id: assignment.branchIdAtAssignment, name: '' }
        : { id: '', name: '' },
      departmentAtAssignment: assignment.departmentIdAtAssignment
        ? { id: assignment.departmentIdAtAssignment, name: '' }
        : { id: '', name: '' },
      closedAt: assignment.closedAt?.toISOString(),
      closedBy: assignment.closedByUser
        ? this.toSafeUserReference(assignment.closedByUser)
        : undefined,
      acknowledgedAt: assignment.acknowledgedAt?.toISOString(),
      sourceType: assignment.sourceType ?? 'MANUAL',
      sourceId: assignment.sourceId ?? undefined,
      allowedActions,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    };
  }

  toLicenseAllocationResponse(
    allocation: LicenseAllocationRecord,
    allowedActions: LicenseAllocationAllowedAction[],
  ) {
    return {
      id: allocation.id,
      version: allocation.version ?? 1,
      status: allocation.status,
      assetId: allocation.assetId,
      employee: this.toSafeEmployeeReference(allocation.employee),
      pool: this.toAssetSummary(allocation.asset, []),
      allocatedAt: allocation.allocatedAt.toISOString(),
      allocatedBy: this.toSafeUserReference(allocation.allocatedByUser),
      revokedAt: allocation.revokedAt?.toISOString(),
      revokedBy: allocation.revokedByUser
        ? this.toSafeUserReference(allocation.revokedByUser)
        : undefined,
      acknowledgedAt: allocation.acknowledgedAt?.toISOString(),
      sourceType: allocation.sourceType ?? 'MANUAL',
      sourceId: allocation.sourceId ?? undefined,
      allowedActions,
      createdAt: allocation.createdAt.toISOString(),
      updatedAt: allocation.updatedAt.toISOString(),
    };
  }

  toDepartmentGrantResponse(
    grant: GrantRecord,
    allowedActions: DepartmentGrantAllowedAction[],
  ) {
    return {
      id: grant.id,
      version: grant.version,
      user: this.toSafeUserReference(grant.user),
      company: {
        id: grant.department.branch.company.id,
        name: grant.department.branch.company.companyName,
      },
      branch: {
        id: grant.department.branch.id,
        name: grant.department.branch.branchName,
      },
      department: {
        id: grant.department.id,
        name: grant.department.departmentName,
      },
      active: !grant.revokedAt,
      grantedBy: this.toSafeUserReference(grant.grantedByUser),
      grantedAt: grant.grantedAt.toISOString(),
      revokedAt: grant.revokedAt?.toISOString(),
      revokedBy: grant.revokedByUser
        ? this.toSafeUserReference(grant.revokedByUser)
        : undefined,
      allowedActions,
    };
  }

  toPaginatedInventory<TItem>(
    items: TItem[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<TItem> {
    return { items, total, page, limit };
  }

  toTransferResponse(
    transfer: {
      id: string;
      version: number;
      status: string;
      reason: string;
      requestedAt: Date;
      requestedByUserId: string;
      fromDepartmentId: string;
      toDepartmentId: string;
      decidedAt?: Date | null;
      fromDepartment: { id: string; departmentName: string };
      toDepartment: { id: string; departmentName: string };
      requestedByUser: { id: string; displayName: string | null };
      decidedByUser?: { id: string; displayName: string | null } | null;
      asset: {
        id: string;
        assetCode: string;
        assetName: string;
        version: number;
      };
    },
    allowedActions: TransferAllowedAction[] = [],
  ) {
    return {
      id: transfer.id,
      version: transfer.version,
      status: transfer.status,
      asset: {
        id: transfer.asset.id,
        code: transfer.asset.assetCode,
        name: transfer.asset.assetName,
        version: transfer.asset.version,
      },
      fromDepartment: {
        id: transfer.fromDepartment.id,
        name: transfer.fromDepartment.departmentName,
      },
      toDepartment: {
        id: transfer.toDepartment.id,
        name: transfer.toDepartment.departmentName,
      },
      requestedBy: this.toSafeUserReference(transfer.requestedByUser),
      requestedAt: transfer.requestedAt.toISOString(),
      decidedBy: transfer.decidedByUser
        ? this.toSafeUserReference(transfer.decidedByUser)
        : undefined,
      decidedAt: transfer.decidedAt?.toISOString(),
      allowedActions,
    };
  }

  toCustodyRequestResponse(request: {
    id: string;
    version: number;
    status: string;
    requestType: string;
    targetType: string;
    requestedAt: Date;
    employeeNote?: string | null;
    resolutionNote?: string | null;
    employeeAssetId?: string | null;
    licenseAllocationId?: string | null;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string | null;
    };
    employeeAsset?: {
      id: string;
      version: number;
      asset: {
        id: string;
        version: number;
        assetCode: string;
        assetName: string;
      };
    } | null;
    licenseAllocation?: {
      id: string;
      version: number;
      asset: {
        id: string;
        version: number;
        assetCode: string;
        assetName: string;
      };
    } | null;
  }) {
    const target = request.licenseAllocation ?? request.employeeAsset;
    const asset = target?.asset;
    const canResolve =
      request.status === 'SUBMITTED' || request.status === 'IN_REVIEW';

    return {
      id: request.id,
      version: request.version,
      status: request.status,
      requestType: request.requestType,
      targetType: request.targetType,
      employeeAssetId: request.employeeAssetId ?? undefined,
      licenseAllocationId: request.licenseAllocationId ?? undefined,
      targetVersion: target?.version,
      assetVersion: asset?.version,
      asset: asset
        ? {
            id: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
          }
        : undefined,
      employee: this.toSafeEmployeeReference(request.employee),
      requestedAt: request.requestedAt.toISOString(),
      employeeNote: request.employeeNote ?? undefined,
      allowedActions: canResolve ? ['COMPLETE', 'REJECT'] : [],
    };
  }

  toClearanceItemResponse(item: {
    id: string;
    version: number;
    status: string;
    employeeAssetId?: string | null;
    licenseAllocationId?: string | null;
    resolutionType?: string | null;
  }) {
    return {
      id: item.id,
      version: item.version,
      status: item.status,
      employeeAssetId: item.employeeAssetId ?? undefined,
      licenseAllocationId: item.licenseAllocationId ?? undefined,
      resolutionType: item.resolutionType ?? undefined,
      allowedActions: item.status === 'OPEN' ? ['REQUEST_WAIVER'] : [],
    };
  }

  toClearanceWaiverResponse(
    waiver: {
      id: string;
      version: number;
      status: string;
      reasonCode: string;
      reason?: string;
      requestedAt: Date;
      decidedAt?: Date | null;
      requestedByUser: { id: string; displayName: string | null };
      decidedByUser?: { id: string; displayName: string | null } | null;
      clearanceItem: {
        id: string;
        version: number;
        employeeAsset?: {
          id: string;
          version: number;
          assetId: string;
          asset?: { id: string; version: number };
        } | null;
        licenseAllocation?: {
          id: string;
          version: number;
          assetId: string;
          asset?: { id: string; version: number };
        } | null;
      };
    },
    allowedActions: WaiverAllowedAction[] = [],
  ) {
    const target =
      waiver.clearanceItem.employeeAsset ??
      waiver.clearanceItem.licenseAllocation;
    const assetVersion = target?.asset?.version;

    return {
      id: waiver.id,
      version: waiver.version,
      status: waiver.status,
      reasonCode: waiver.reasonCode,
      reason: waiver.reason,
      requestedAt: waiver.requestedAt.toISOString(),
      requestedBy: this.toSafeUserReference(waiver.requestedByUser),
      decidedAt: waiver.decidedAt?.toISOString(),
      decidedBy: waiver.decidedByUser
        ? this.toSafeUserReference(waiver.decidedByUser)
        : undefined,
      clearanceItemId: waiver.clearanceItem.id,
      clearanceItemVersion: waiver.clearanceItem.version,
      clearanceItem: {
        id: waiver.clearanceItem.id,
        version: waiver.clearanceItem.version,
        employeeAsset: waiver.clearanceItem.employeeAsset ?? undefined,
        licenseAllocation: waiver.clearanceItem.licenseAllocation ?? undefined,
      },
      targetVersion: target?.version,
      assetId: target?.assetId,
      assetVersion,
      allowedActions,
    };
  }

  private toAssetSummary(
    asset: EmployeeAssetRecord['asset'] | LicenseAllocationRecord['asset'],
    allowedActions: AssetInventoryAction[],
  ) {
    return {
      id: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      version: asset.version,
      kind: asset.kind,
      trackingMode: asset.trackingMode,
      lifecycleStatus: asset.lifecycleStatus,
      availabilityStatus:
        asset.status === 'ASSIGNED' ? 'ASSIGNED' : 'AVAILABLE',
      expiryState: 'NOT_APPLICABLE' as const,
      company: { id: asset.company.id, name: asset.company.companyName },
      branch: asset.branch
        ? { id: asset.branch.id, name: asset.branch.branchName }
        : { id: '', name: '' },
      department: asset.department
        ? { id: asset.department.id, name: asset.department.departmentName }
        : { id: '', name: '' },
      assetType: asset.assetType
        ? {
            id: asset.assetType.id,
            name: asset.assetType.assetTypeName,
          }
        : {
            id: '',
            name: 'Unknown type',
          },
      warrantyExpiry: asset.warrantyExpiry?.toISOString().slice(0, 10),
      allowedActions,
    };
  }

  private toSafeEmployeeReference(employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
  }) {
    return {
      id: employee.id,
      code: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName ?? ''}`.trim(),
    };
  }

  toPaginatedSafeEmployees<
    T extends {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string | null;
    },
  >(
    rows: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<{
    id: string;
    code: string;
    name: string;
  }> {
    return {
      items: rows.map((row) => this.toSafeEmployeeReference(row)),
      total,
      page,
      limit,
    };
  }

  private toSafeUserReference(user: {
    id: string;
    displayName: string | null;
    email?: string | null;
  }) {
    return {
      id: user.id,
      name: user.displayName ?? user.email ?? 'Unknown',
    };
  }
}
