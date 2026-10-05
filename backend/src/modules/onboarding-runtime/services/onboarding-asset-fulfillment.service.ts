import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AssetLifecycleStatus,
  AssetTrackingMode,
  OnboardingTaskResultType,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { AssetAccessService } from '../../asset-domain/asset-access.service';
import { createAssetAccessContext } from '../../asset-domain/asset-access.types';
import { AssetCustodyService } from '../../asset-domain/asset-custody.service';
import { AssetFeatureGateService } from '../../asset-domain/asset-feature-gate.service';
import { LicenseAllocationService } from '../../asset-domain/license-allocation.service';
import { ASSET_PERMISSIONS } from '../../asset-domain/policies/asset-permissions';

import type {
  OnboardingActorContext,
  OnboardingAssetCandidateResponse,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

interface AssetTaskRecord {
  id: string;
  attemptNo: number;
  companyId: string | null;
  branchId: string | null;
  employeeId: string | null;
  workType: string;
  referenceType: string | null;
  referenceId: string | null;
}

interface AssetCandidateQuery {
  keyword?: string;
  page?: number;
  limit?: number;
}

export interface OnboardingAssetFulfillmentResult {
  resultType: OnboardingTaskResultType;
  employeeAssetId: string | null;
  softwareLicenseAllocationId: string | null;
  assetId: string;
  safeAssetLabel: string;
}

@Injectable()
export class OnboardingAssetFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly featureGate: AssetFeatureGateService,
    private readonly custody: AssetCustodyService,
    private readonly licenses: LicenseAllocationService,
  ) {}

  isAvailable(
    actor?: OnboardingActorContext,
    organization?: {
      companyId: string;
      branchId?: string | null;
      departmentId?: string | null;
    },
  ): boolean {
    if (!actor || !organization) {
      return false;
    }

    // The runtime command checks the Company's entitlement before it reads or
    // mutates inventory. This synchronous projection only describes actor
    // permissions and must not recreate an environment-based rollout check.
    const broad = actor.permissions.includes(
      ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE,
    );
    const departmentScoped =
      actor.permissions.includes(
        ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
      ) &&
      organization.departmentId != null &&
      actor.assetGrantedDepartmentIds.includes(organization.departmentId);

    return broad || departmentScoped;
  }

  async candidates(
    user: AuthenticatedUser,
    task: AssetTaskRecord,
    query: AssetCandidateQuery,
  ): Promise<OnboardingAssetCandidateResponse> {
    this.assertTaskContract(task);
    const context = createAssetAccessContext(user);
    await this.featureGate.assertEnabledForCompany(task.companyId!);

    if (!this.access.canManageCustody(context)) {
      throw new NotFoundException();
    }

    const assetType = await this.prisma.assetType.findFirst({
      where: {
        id: task.referenceId!,
        companyId: task.companyId!,
        isActive: true,
        archivedAt: null,
        trackingMode: {
          in: [AssetTrackingMode.INDIVIDUAL, AssetTrackingMode.POOL],
        },
      },
    });
    if (!assetType) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'The Asset Type configured for this task is unavailable.',
      );
    }
    if (
      assetType.trackingMode !== AssetTrackingMode.INDIVIDUAL &&
      assetType.trackingMode !== AssetTrackingMode.POOL
    ) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'The Asset Type configured for this task is unavailable.',
      );
    }

    if (assetType.trackingMode === AssetTrackingMode.POOL) {
      await this.featureGate.assertEnabledForCompany(task.companyId!);
    }

    const authorizedAssetWhere = await this.access.buildCustodyAssetWhere(
      context,
      'manage',
    );
    const rows = await this.prisma.asset.findMany({
      where: {
        companyId: task.companyId!,
        assetTypeId: task.referenceId!,
        trackingMode: assetType.trackingMode,
        lifecycleStatus: AssetLifecycleStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        AND: [
          authorizedAssetWhere,
          ...(query.keyword?.trim()
            ? [
                {
                  OR: [
                    {
                      assetCode: {
                        contains: query.keyword.trim(),
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      assetName: {
                        contains: query.keyword.trim(),
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
        ...(assetType.trackingMode === AssetTrackingMode.INDIVIDUAL
          ? {
              branchId: task.branchId!,
              status: 'AVAILABLE',
              employeeAssets: {
                none: { custodyStatus: 'ASSIGNED', closedAt: null },
              },
            }
          : { softwareLicenseDetail: { isNot: null } }),
      },
      include: {
        assetType: true,
        branch: true,
        department: true,
        softwareLicenseDetail: true,
      },
      orderBy: [{ assetCode: 'asc' }],
    });

    const availableRows = rows.filter(
      (asset) =>
        !asset.softwareLicenseDetail ||
        asset.softwareLicenseDetail.allocatedSeatCount <
          asset.softwareLicenseDetail.seatCapacity,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const pageRows = availableRows.slice((page - 1) * limit, page * limit);

    return {
      trackingMode: assetType.trackingMode,
      items: pageRows.map((asset) => ({
        assetId: asset.id,
        version: asset.version,
        code: asset.assetCode,
        safeLabel: `${asset.assetCode} - ${asset.assetName}`,
        assetType: {
          id: asset.assetType.id,
          name: asset.assetType.assetTypeName,
        },
        owningBranch: {
          id: asset.branch.id,
          name: asset.branch.branchName,
        },
        owningDepartment: {
          id: asset.department.id,
          name: asset.department.departmentName,
        },
        availability:
          asset.trackingMode === AssetTrackingMode.POOL
            ? 'CAPACITY_AVAILABLE'
            : 'AVAILABLE',
        expiryState: this.expiryState(
          asset.softwareLicenseDetail?.expiresOn ?? asset.warrantyExpiry,
        ),
        availableCapacity: asset.softwareLicenseDetail
          ? asset.softwareLicenseDetail.seatCapacity -
            asset.softwareLicenseDetail.allocatedSeatCount
          : undefined,
      })),
      total: availableRows.length,
      page,
      limit,
    };
  }

  async fulfillWithinTransaction(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    task: AssetTaskRecord,
    input: {
      assetId: string;
      expectedAssetVersion: number;
      effectiveDate: string;
    },
  ): Promise<OnboardingAssetFulfillmentResult> {
    this.assertTaskContract(task);
    const context = createAssetAccessContext(user);
    await this.featureGate.assertEnabledForCompany(task.companyId!);

    if (!this.access.canManageCustody(context)) {
      throw new NotFoundException();
    }

    const authorizedAssetWhere = await this.access.buildCustodyAssetWhere(
      context,
      'manage',
    );
    const asset = await tx.asset.findFirst({
      where: {
        id: input.assetId,
        companyId: task.companyId!,
        assetTypeId: task.referenceId!,
        lifecycleStatus: AssetLifecycleStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        AND: [authorizedAssetWhere],
      },
      include: { softwareLicenseDetail: true },
    });
    if (!asset) {
      throw new NotFoundException();
    }

    if (
      asset.trackingMode !== AssetTrackingMode.INDIVIDUAL &&
      asset.trackingMode !== AssetTrackingMode.POOL
    ) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'Location-tracked Assets cannot fulfill an Onboarding task.',
      );
    }

    const sourceCommandKey = `onboarding-task:${task.id}:attempt:${task.attemptNo}`;
    const sourceInput = {
      assetId: asset.id,
      employeeId: task.employeeId!,
      effectiveDate: input.effectiveDate,
      sourceType: 'ONBOARDING_TASK' as const,
      sourceId: task.id,
      sourceCommandKey,
      actorUserId: user.id,
      expectedAssetVersion: input.expectedAssetVersion,
    };

    if (asset.trackingMode === AssetTrackingMode.INDIVIDUAL) {
      if (asset.branchId !== task.branchId) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ASSET_PERMISSION_REQUIRED,
          'The physical Asset must belong to the employee Branch.',
        );
      }
      const custody = await this.custody.assignWithinTransaction(
        tx,
        sourceInput,
      );
      return {
        resultType: OnboardingTaskResultType.EMPLOYEE_ASSET,
        employeeAssetId: custody.id,
        softwareLicenseAllocationId: null,
        assetId: asset.id,
        safeAssetLabel: `${asset.assetCode} - ${asset.assetName}`,
      };
    }

    await this.featureGate.assertEnabledForCompany(task.companyId!);
    const allocation = await this.licenses.allocateWithinTransaction(
      tx,
      asset.id,
      sourceInput,
    );
    return {
      resultType: OnboardingTaskResultType.SOFTWARE_LICENSE_ALLOCATION,
      employeeAssetId: null,
      softwareLicenseAllocationId: allocation.id,
      assetId: asset.id,
      safeAssetLabel: `${asset.assetCode} - ${asset.assetName}`,
    };
  }

  private assertTaskContract(task: AssetTaskRecord): void {
    if (
      task.workType !== 'ASSET' ||
      task.referenceType !== 'ASSET_TYPE' ||
      !task.referenceId ||
      !task.companyId ||
      !task.branchId ||
      !task.employeeId
    ) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'The Onboarding Asset task contract is incomplete.',
      );
    }
  }

  private expiryState(date: Date | null | undefined): string | undefined {
    if (!date) {
      return undefined;
    }
    return date.getTime() < Date.now() ? 'EXPIRED' : 'ACTIVE';
  }
}
