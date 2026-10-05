import { Prisma } from '@prisma/client';

/** Active physical custody slice for list/detail projections. */
export const ACTIVE_EMPLOYEE_ASSET_INCLUDE = {
  where: {
    status: 'ASSIGNED',
    returnedDate: null,
  },
  take: 1,
} as const;

export const ASSET_INVENTORY_LIST_INCLUDE = {
  company: true,
  branch: true,
  department: true,
  assetType: {
    include: {
      assetCategory: true,
    },
  },
  employeeAssets: ACTIVE_EMPLOYEE_ASSET_INCLUDE,
  softwareLicenseDetail: true,
} satisfies Prisma.AssetInclude;

export const ASSET_CUSTODY_DETAIL_INCLUDE = {
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

export const ASSET_LICENSE_ALLOCATION_DETAIL_INCLUDE = {
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

export const ASSET_TRANSFER_DETAIL_INCLUDE = {
  requestedByUser: { select: { id: true, displayName: true } },
  decidedByUser: { select: { id: true, displayName: true } },
  cancelledByUser: { select: { id: true, displayName: true } },
  forcedByUser: { select: { id: true, displayName: true } },
  fromDepartment: {
    select: { id: true, departmentName: true, branchId: true },
  },
  toDepartment: {
    select: { id: true, departmentName: true, branchId: true },
  },
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
} satisfies Prisma.AssetOwnershipTransferInclude;

export const ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },
  reviewedByUser: { select: { id: true, displayName: true } },
  resolvedByUser: { select: { id: true, displayName: true } },
  employeeAsset: {
    include: {
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
    },
  },
  licenseAllocation: {
    include: {
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
    },
  },
} satisfies Prisma.AssetCustodyRequestInclude;
