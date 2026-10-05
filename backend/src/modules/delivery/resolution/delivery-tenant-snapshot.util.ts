import type { DeliveryTenantSnapshot } from './delivery-recipient.types';

export type TenantSnapshotCheck = 'OK' | 'SNAPSHOT_INCOMPLETE' | 'MISMATCH';

/**
 * Outbox Company/Branch snapshot must match the reloaded aggregate.
 * Missing Outbox company is incomplete. Branch is checked when present
 * on the event. Payload tenant IDs are never used.
 */
export function verifyTenantSnapshot(
  eventSnapshot: DeliveryTenantSnapshot,
  aggregateSnapshot: DeliveryTenantSnapshot,
): TenantSnapshotCheck {
  if (!eventSnapshot.companyId || !aggregateSnapshot.companyId) {
    return 'SNAPSHOT_INCOMPLETE';
  }
  if (eventSnapshot.companyId !== aggregateSnapshot.companyId) {
    return 'MISMATCH';
  }
  if (
    eventSnapshot.branchId &&
    aggregateSnapshot.branchId &&
    eventSnapshot.branchId !== aggregateSnapshot.branchId
  ) {
    return 'MISMATCH';
  }
  if (
    eventSnapshot.companyGroupId &&
    aggregateSnapshot.companyGroupId &&
    eventSnapshot.companyGroupId !== aggregateSnapshot.companyGroupId
  ) {
    return 'MISMATCH';
  }
  return 'OK';
}

export function tenantCheckToException(
  check: TenantSnapshotCheck,
): { reasonCode: string; redactedDetail: string } | null {
  if (check === 'OK') {
    return null;
  }
  if (check === 'SNAPSHOT_INCOMPLETE') {
    return {
      reasonCode: 'TENANT_SNAPSHOT_INCOMPLETE',
      redactedDetail: 'Outbox or aggregate is missing a Company snapshot',
    };
  }
  return {
    reasonCode: 'TENANT_MISMATCH',
    redactedDetail: 'Outbox tenant snapshot does not match the aggregate',
  };
}
