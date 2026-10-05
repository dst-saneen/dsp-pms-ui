/**
 * Deterministic Delivery V2 backfill rules (Gate P0.3).
 *
 * Ambiguous rows are never guessed. Those remain for the preflight report
 * and manual review before any contract migration.
 */

export type DeliveryLegacyStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'BYPASSED'
  | 'CANCELLED';

export type DeliveryCanonicalStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'RETRY_WAIT'
  | 'RECONCILING'
  | 'DEAD_LETTER'
  | 'BYPASSED'
  | 'CANCELLED';

export type DeliveryLegacyAttemptOutcome =
  | 'ACCEPTED'
  | 'REJECTED_PERMANENT'
  | 'REJECTED_TRANSIENT'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export type DeliveryCanonicalAttemptOutcome =
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'TRANSIENT_FAILURE'
  | 'PERMANENT_FAILURE'
  | 'AMBIGUOUS'
  | 'BYPASSED';

export function mapLegacyAttemptOutcome(
  outcome: string,
): DeliveryCanonicalAttemptOutcome | null {
  switch (outcome) {
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'REJECTED_PERMANENT':
      return 'PERMANENT_FAILURE';
    case 'REJECTED_TRANSIENT':
    case 'NETWORK_ERROR':
      return 'TRANSIENT_FAILURE';
    case 'TIMEOUT':
      return 'AMBIGUOUS';
    case 'DELIVERED':
    case 'TRANSIENT_FAILURE':
    case 'PERMANENT_FAILURE':
    case 'AMBIGUOUS':
    case 'BYPASSED':
      return outcome;
    default:
      return null;
  }
}

/**
 * Status mapping for a single message. Returns null when the row must stay
 * untouched and appear in the preflight/reconciliation report.
 */
export function mapLegacyMessageStatus(input: {
  status: string;
  hasActiveLease: boolean;
  hasProviderDeliveredEvent: boolean;
  latestAttemptOutcome?: string | null;
}): DeliveryCanonicalStatus | null {
  switch (input.status) {
    case 'QUEUED':
      return 'QUEUED';
    case 'SENDING':
      return input.hasActiveLease ? 'PROCESSING' : 'RETRY_WAIT';
    case 'DELIVERED':
      return input.hasProviderDeliveredEvent ? 'DELIVERED' : null;
    case 'FAILED': {
      const mapped = input.latestAttemptOutcome
        ? mapLegacyAttemptOutcome(input.latestAttemptOutcome)
        : null;
      if (mapped === 'PERMANENT_FAILURE') {
        return 'DEAD_LETTER';
      }
      if (mapped === 'TRANSIENT_FAILURE') {
        return 'RETRY_WAIT';
      }
      if (mapped === 'AMBIGUOUS') {
        return 'RECONCILING';
      }
      return null;
    }
    case 'DEAD_LETTER':
    case 'BYPASSED':
    case 'CANCELLED':
      return input.status;
    case 'PROCESSING':
    case 'ACCEPTED':
    case 'RETRY_WAIT':
    case 'RECONCILING':
    case 'BOUNCED_SOFT':
    case 'BOUNCED_HARD':
    case 'COMPLAINED':
      return input.status as DeliveryCanonicalStatus;
    default:
      return null;
  }
}

export function mapRecipientKind(input: {
  recipientKind: string;
  channel: string;
}): string | null {
  if (input.recipientKind === 'CANDIDATE' && input.channel === 'EMAIL') {
    return 'EXTERNAL_EMAIL';
  }
  if (
    input.channel === 'IN_APP' &&
    (input.recipientKind === 'EMPLOYEE' ||
      input.recipientKind === 'HR' ||
      input.recipientKind === 'PANEL_MEMBER' ||
      input.recipientKind === 'SYSTEM')
  ) {
    // Becomes USER only after a scoped User lookup in the backfill service.
    return null;
  }
  return input.recipientKind;
}

export function mapProvider(provider: string): string {
  if (provider === 'IN_APP_STORE') {
    return 'INTERNAL';
  }
  return provider;
}
