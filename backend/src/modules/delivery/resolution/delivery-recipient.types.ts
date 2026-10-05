import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
} from '@prisma/client';

export interface DeliveryTenantSnapshot {
  companyGroupId: string | null;
  companyId: string | null;
  branchId: string | null;
}

export interface ResolvedRecipient {
  kind: DeliveryRecipientKind;
  recipientId: string;
  channels: DeliveryChannel[];
  toAddress?: string;
  displayName?: string;
  subject?: string;
  recipientUserId?: string;
  recipientEmployeeId?: string;
}

export interface ResolutionExceptionInput {
  reasonCode: string;
  redactedDetail?: string;
}

export interface RecipientResolutionResult {
  recipients: ResolvedRecipient[];
  exceptions: ResolutionExceptionInput[];
}

export function tenantSnapshotFromOutbox(
  event: OutboxEvent,
): DeliveryTenantSnapshot {
  return {
    companyGroupId: event.companyGroupId,
    companyId: event.companyId,
    branchId: event.branchId,
  };
}
