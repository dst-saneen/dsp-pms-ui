export type DeliveryMessageStatus =
  | "QUEUED"
  | "PROCESSING"
  | "ACCEPTED"
  | "RETRY_WAIT"
  | "RECONCILING"
  | "BOUNCED_SOFT"
  | "BOUNCED_HARD"
  | "COMPLAINED"
  | "SENDING"
  | "DELIVERED"
  | "FAILED"
  | "DEAD_LETTER"
  | "BYPASSED"
  | "CANCELLED";

export type DeliveryChannel = "EMAIL" | "IN_APP";
export type DeliveryProvider =
  | "SMTP"
  | "ZEPTOMAIL"
  | "INTERNAL"
  | "IN_APP_STORE"
  | "NONE";
export type DeliveryRecipientKind =
  | "EXTERNAL_EMAIL"
  | "USER"
  | "CANDIDATE"
  | "EMPLOYEE"
  | "HR"
  | "PANEL_MEMBER"
  | "SYSTEM";

export type DeliveryAllowedAction = "RETRY" | "CANCEL" | "RELEASE_SUPPRESSION";

export type DeliveryAttemptOutcome =
  | "ACCEPTED"
  | "DELIVERED"
  | "TRANSIENT_FAILURE"
  | "PERMANENT_FAILURE"
  | "AMBIGUOUS"
  | "BYPASSED"
  | "REJECTED_PERMANENT"
  | "REJECTED_TRANSIENT"
  | "TIMEOUT"
  | "NETWORK_ERROR";

export interface DeliveryMessage {
  id: string;
  version: number;
  outboxEventType: string;
  eventType?: string | null;
  aggregateType?: string | null;
  aggregateId?: string | null;
  dedupeKey: string;
  recipientKind: DeliveryRecipientKind;
  recipientDisplay?: string | null;
  /** @deprecated use recipientDisplay */
  toDisplayName?: string | null;
  channel: DeliveryChannel;
  provider: DeliveryProvider;
  status: DeliveryMessageStatus;
  companyId?: string | null;
  branchId?: string | null;
  companyName?: string | null;
  branchName?: string | null;
  attemptCount: number;
  queuedAt?: string;
  nextAttemptAt: string;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  acceptedAt?: string | null;
  deliveredAt: string | null;
  terminalAt?: string | null;
  deadLetteredAt?: string | null;
  subject?: string | null;
  clientReference?: string | null;
  lastErrorCode: string | null;
  bypassReason: string | null;
  createdAt: string;
  allowedActions?: DeliveryAllowedAction[];
  actionRequirements?: {
    expectedVersion: number;
    requiresReason: boolean;
  };
}

export interface DeliveryAttempt {
  id: string;
  attemptNo: number;
  outcome: DeliveryAttemptOutcome;
  providerRequestId: string | null;
  providerStatusCode: number | null;
  errorCode: string | null;
  attemptedAt: string;
  durationMs: number | null;
}

export interface EmailSuppression {
  id: string;
  reason: string;
  suppressedAt: string;
  releasedAt: string | null;
  companyGroupId: string | null;
  version?: number;
  createdAt: string;
  allowedActions?: DeliveryAllowedAction[];
  actionRequirements?: {
    expectedVersion: number;
    requiresReason: boolean;
  };
}

export interface DeliveryHealthItem {
  status: DeliveryMessageStatus;
  channel: DeliveryChannel;
  count: number;
}

export interface RecipientException {
  id: string;
  outboxEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  companyId: string | null;
  branchId: string | null;
  reasonCode: string;
  redactedDetail: string | null;
  status: "OPEN" | "RESOLVED";
  version: number;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DeliveryHealthResponse {
  resolvedMode: string;
  allowlistSize: number;
  jobs: unknown;
  queue: DeliveryHealthItem[];
  openRecipientExceptions: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  /** @deprecated use items */
  data?: T[];
}

export interface ListDeliveryMessagesParams {
  status?: DeliveryMessageStatus;
  channel?: DeliveryChannel;
  eventType?: string;
  keyword?: string;
  companyId?: string;
  branchId?: string;
  recipientId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "nextAttemptAt" | "deliveredAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface DeliveryCommandBody {
  expectedVersion: number;
  operationId: string;
  reason: string;
}
