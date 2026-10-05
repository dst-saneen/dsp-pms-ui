import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { AssetCapabilityService } from './asset-capability.service';
import { AssetResponseMapper } from './asset-response.mapper';

const MY_PHYSICAL_CUSTODY_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      branchId: true,
      departmentId: true,
    },
  },
  assignedByUser: { select: { id: true, displayName: true } },
  closedByUser: { select: { id: true, displayName: true } },
  asset: {
    include: {
      company: { select: { id: true, companyName: true } },
      branch: { select: { id: true, branchName: true } },
      department: { select: { id: true, departmentName: true } },
      assetType: {
        select: {
          id: true,
          assetTypeName: true,
          kind: true,
          trackingMode: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeAssetInclude;

const MY_LICENSE_ALLOCATION_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },
  allocatedByUser: { select: { id: true, displayName: true } },
  revokedByUser: { select: { id: true, displayName: true } },
  asset: {
    include: {
      company: { select: { id: true, companyName: true } },
      branch: { select: { id: true, branchName: true } },
      department: { select: { id: true, departmentName: true } },
      assetType: {
        select: {
          id: true,
          assetTypeName: true,
          kind: true,
          trackingMode: true,
        },
      },
      softwareLicenseDetail: true,
    },
  },
} satisfies Prisma.SoftwareLicenseAllocationInclude;

@Injectable()
export class AssetSelfServiceQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: AssetCapabilityService,
    private readonly mapper: AssetResponseMapper,
  ) {}

  /** Bounded current-custody projection for workspace cards (plan §3). */
  async findCurrentByEmployee(employeeId: string) {
    return this.prisma.employeeAsset.findMany({
      where: {
        employeeId,
        returnedDate: null,
        status: 'ASSIGNED',
      },
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            assetType: { select: { assetTypeName: true } },
          },
        },
      },
      orderBy: { assignedDate: 'desc' },
      take: 10,
    });
  }

  async findMyAssets(employeeId: string) {
    const [physicalRows, licenseRows, openRequests] = await Promise.all([
      this.prisma.employeeAsset.findMany({
        where: {
          employeeId,
          returnedDate: null,
          status: 'ASSIGNED',
        },
        include: MY_PHYSICAL_CUSTODY_INCLUDE,
        orderBy: { assignedDate: 'desc' },
      }),
      this.prisma.softwareLicenseAllocation.findMany({
        where: {
          employeeId,
          status: 'ACTIVE',
        },
        include: MY_LICENSE_ALLOCATION_INCLUDE,
        orderBy: { allocatedAt: 'desc' },
      }),
      this.prisma.assetCustodyRequest.findMany({
        where: {
          employeeId,
          status: { in: ['SUBMITTED', 'IN_REVIEW'] },
        },
        select: {
          id: true,
          requestType: true,
          status: true,
          requestedAt: true,
          employeeAssetId: true,
          licenseAllocationId: true,
        },
      }),
    ]);

    const pendingByAssignment = new Map(
      openRequests
        .filter((row) => row.employeeAssetId)
        .map((row) => [row.employeeAssetId as string, row]),
    );
    const pendingByLicense = new Map(
      openRequests
        .filter((row) => row.licenseAllocationId)
        .map((row) => [row.licenseAllocationId as string, row]),
    );

    const physicalAssignments = physicalRows.map((assignment) => {
      const pending = pendingByAssignment.get(assignment.id);
      return {
        ...this.mapper.toEmployeeAssetResponse(
          assignment,
          this.capabilities.getEmployeeAssetAllowedActions(assignment, {
            isSelfService: true,
            hasOpenRequest: Boolean(pending),
          }),
        ),
        pendingRequest: pending
          ? {
              id: pending.id,
              requestType: pending.requestType,
              status: pending.status,
              requestedAt: pending.requestedAt.toISOString(),
            }
          : null,
      };
    });

    const licenseAllocations = licenseRows.map((allocation) => {
      const pending = pendingByLicense.get(allocation.id);
      return {
        ...this.mapper.toLicenseAllocationResponse(
          allocation,
          this.capabilities.getLicenseAllocationAllowedActions(allocation, {
            isSelfService: true,
            hasOpenRequest: Boolean(pending),
          }),
        ),
        pendingRequest: pending
          ? {
              id: pending.id,
              requestType: pending.requestType,
              status: pending.status,
              requestedAt: pending.requestedAt.toISOString(),
            }
          : null,
      };
    });

    const acknowledgementPending =
      physicalAssignments.filter((item) => !item.acknowledgedAt).length +
      licenseAllocations.filter((item) => !item.acknowledgedAt).length;

    return {
      summary: {
        physicalAssigned: physicalAssignments.length,
        activeLicenses: licenseAllocations.length,
        acknowledgementPending,
        openRequests: openRequests.length,
      },
      physicalAssignments,
      licenseAllocations,
    };
  }
}
