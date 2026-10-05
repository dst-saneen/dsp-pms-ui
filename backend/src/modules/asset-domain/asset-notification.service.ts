import { Injectable } from '@nestjs/common';

import { OutboxWriterService, PrismaTx } from '../outbox/outbox-writer.service';

export const ASSET_NOTIFICATION_EVENT = {
  ASSIGNED: 'ASSET_ASSIGNED',
  LICENSE_ALLOCATED: 'ASSET_LICENSE_ALLOCATED',
  ACKNOWLEDGEMENT_PENDING: 'ASSET_ACKNOWLEDGEMENT_PENDING',
  CUSTODY_REQUEST_SUBMITTED: 'ASSET_CUSTODY_REQUEST_SUBMITTED',
  CUSTODY_REQUEST_RESOLVED: 'ASSET_CUSTODY_REQUEST_RESOLVED',
  TRANSFER_REQUESTED: 'ASSET_TRANSFER_REQUESTED',
  TRANSFER_ACCEPTED: 'ASSET_TRANSFER_ACCEPTED',
  TRANSFER_REJECTED: 'ASSET_TRANSFER_REJECTED',
  EXPIRY_ATTENTION: 'ASSET_EXPIRY_ATTENTION',
  LICENSE_CAPACITY_LOW: 'ASSET_LICENSE_CAPACITY_LOW',
  LICENSE_CAPACITY_FULL: 'ASSET_LICENSE_CAPACITY_FULL',
  CLEARANCE_WAIVER_REQUESTED: 'ASSET_CLEARANCE_WAIVER_REQUESTED',
  CLEARANCE_WAIVER_APPROVED: 'ASSET_CLEARANCE_WAIVER_APPROVED',
  CLEARANCE_WAIVER_REJECTED: 'ASSET_CLEARANCE_WAIVER_REJECTED',
} as const;

export type AssetNotificationEventCode =
  (typeof ASSET_NOTIFICATION_EVENT)[keyof typeof ASSET_NOTIFICATION_EVENT];

export interface AssetNotificationPayload {
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string;
  employeeId?: string;
  assetId?: string;
  employeeAssetId?: string;
  licenseAllocationId?: string;
  assetTransferId?: string;
  assetCustodyRequestId?: string;
  assetClearanceItemId?: string;
  assetClearanceWaiverId?: string;
  status?: string;
  recipientUserIds?: string[];
}

@Injectable()
export class AssetNotificationService {
  constructor(private readonly outboxWriter: OutboxWriterService) {}

  async enqueue(
    tx: PrismaTx,
    eventType: AssetNotificationEventCode,
    aggregateType: string,
    aggregateId: string,
    payload: AssetNotificationPayload,
    dedupeKey: string,
  ): Promise<void> {
    await this.outboxWriter.write(tx, {
      aggregateType,
      aggregateId,
      eventType,
      dedupeKey,
      companyId: payload.companyId ?? null,
      branchId: payload.branchId ?? null,
      payload: {
        eventCode: eventType,
        ...payload,
      },
    });
  }
}
