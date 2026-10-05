import { Prisma } from '@prisma/client';

/** Derived availability bucket for inventory filters (plan §9.1). */
export type AssetAvailabilityStatus =
  | 'IN_SERVICE'
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'SEATS_AVAILABLE'
  | 'FULLY_ALLOCATED'
  | 'UNAVAILABLE';

export function buildAssetAvailabilityWhere(
  availabilityStatus: AssetAvailabilityStatus,
): Prisma.AssetWhereInput {
  switch (availabilityStatus) {
    case 'AVAILABLE':
      return {
        status: 'AVAILABLE',
        lifecycleStatus: 'ACTIVE',
        archivedAt: null,
        isActive: true,
      };
    case 'ASSIGNED':
      return {
        status: 'ASSIGNED',
        employeeAssets: {
          some: {
            returnedDate: null,
            status: 'ASSIGNED',
          },
        },
      };
    case 'IN_SERVICE':
      return {
        lifecycleStatus: 'ACTIVE',
        archivedAt: null,
        isActive: true,
      };
    case 'SEATS_AVAILABLE':
      return {
        kind: 'SOFTWARE_LICENSE',
        lifecycleStatus: 'ACTIVE',
        archivedAt: null,
        isActive: true,
      };
    case 'FULLY_ALLOCATED':
      return {
        kind: 'SOFTWARE_LICENSE',
        status: 'ASSIGNED',
      };
    case 'UNAVAILABLE':
      return {
        OR: [
          { isActive: false },
          { archivedAt: { not: null } },
          {
            lifecycleStatus: {
              in: ['DISPOSED', 'LOST', 'RETIRED', 'SUSPENDED'],
            },
          },
        ],
      };
    default:
      return {};
  }
}
