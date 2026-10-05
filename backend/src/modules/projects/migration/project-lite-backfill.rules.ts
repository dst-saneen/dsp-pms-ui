/**
 * Deterministic Project Lite reconcile rules (plan §9 step 2).
 * Ambiguous values return null and must remain for preflight/operator review.
 */

export type ProjectStatusV2 =
  'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type ProjectStageStatusV2 =
  'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type ProjectTaskStatusV2 =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProjectTeamMemberStatusV2 = 'ACTIVE' | 'ENDED';

export type ProjectTaskParticipantStatusV2 = 'ACTIVE' | 'ENDED';

export type WorkLogStatusV2 =
  'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'CANCELLED';

export type TaskSubmissionStatusV2 =
  'SUBMITTED' | 'RETURNED' | 'ACCEPTED' | 'CANCELLED';

export type TaskReviewDecisionV2 = 'RETURN' | 'COMPLETE' | 'CANCEL';

export type ProjectTypeV2 = 'CLIENT' | 'INTERNAL';

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function mapProjectStatusV2(
  status: string | null | undefined,
): ProjectStatusV2 | null {
  switch (normalize(status)) {
    case 'DRAFT':
    case 'PROPOSAL':
    case 'APPROVED':
      return 'DRAFT';
    case 'ACTIVE':
      return 'ACTIVE';
    case 'ON_HOLD':
    case 'ONHOLD':
      return 'ON_HOLD';
    case 'COMPLETED':
    case 'CLOSED':
      return 'COMPLETED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function mapProjectStageStatusV2(
  status: string | null | undefined,
): ProjectStageStatusV2 | null {
  switch (normalize(status)) {
    case 'OPEN':
    case 'PLANNED':
      return 'PLANNED';
    case 'ACTIVE':
      return 'ACTIVE';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function mapProjectTaskStatusV2(
  status: string | null | undefined,
): ProjectTaskStatusV2 | null {
  switch (normalize(status)) {
    case 'NOT_STARTED':
    case 'OPEN':
      return 'OPEN';
    case 'ASSIGNED':
      return 'ASSIGNED';
    case 'IN_PROGRESS':
    case 'INPROGRESS':
      return 'IN_PROGRESS';
    case 'WAITING_REVIEW':
    case 'IN_REVIEW':
    case 'REVIEW':
      return 'WAITING_REVIEW';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function mapProjectTeamMemberStatusV2(input: {
  isActive?: boolean | null;
  allocationStatus?: string | null;
}): ProjectTeamMemberStatusV2 | null {
  const allocation = normalize(input.allocationStatus);
  if (
    allocation === 'ENDED' ||
    allocation === 'INACTIVE' ||
    allocation === 'REMOVED'
  ) {
    return 'ENDED';
  }
  if (allocation === 'ACTIVE') {
    return 'ACTIVE';
  }
  if (input.isActive === false) {
    return 'ENDED';
  }
  if (input.isActive === true) {
    return 'ACTIVE';
  }
  return null;
}

export function mapTaskParticipantStatusV2(
  status: string | null | undefined,
): ProjectTaskParticipantStatusV2 | null {
  switch (normalize(status)) {
    case 'PENDING':
    case 'ACTIVE':
      return 'ACTIVE';
    case 'ENDED':
    case 'REMOVED':
    case 'INACTIVE':
      return 'ENDED';
    default:
      return null;
  }
}

export function mapWorkLogStatusV2(
  status: string | null | undefined,
): WorkLogStatusV2 | null {
  switch (normalize(status)) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'APPROVED':
      return 'APPROVED';
    case 'RETURNED':
    case 'REJECTED':
      return 'RETURNED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function mapTaskSubmissionStatusV2(
  status: string | null | undefined,
): TaskSubmissionStatusV2 | null {
  switch (normalize(status)) {
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'RETURNED':
      return 'RETURNED';
    case 'ACCEPTED':
    case 'COMPLETED':
    case 'APPROVED':
      return 'ACCEPTED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function mapTaskReviewDecisionV2(
  decision: string | null | undefined,
): TaskReviewDecisionV2 | null {
  switch (normalize(decision)) {
    case 'RETURN':
    case 'REJECT':
    case 'REJECTED':
      return 'RETURN';
    case 'COMPLETE':
    case 'APPROVE':
    case 'APPROVED':
    case 'ACCEPT':
    case 'ACCEPTED':
      return 'COMPLETE';
    case 'CANCEL':
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCEL';
    default:
      return null;
  }
}

/**
 * Infer CLIENT only when legacy client evidence exists.
 * Never invent a BusinessParty from name.
 */
export function inferProjectType(input: {
  clientName?: string | null;
  clientContact?: string | null;
  contractValue?: string | number | null;
}): ProjectTypeV2 {
  const hasClientName = Boolean(input.clientName?.trim());
  const hasClientContact = Boolean(input.clientContact?.trim());
  const hasContractValue =
    input.contractValue !== null &&
    input.contractValue !== undefined &&
    String(input.contractValue).trim() !== '';

  return hasClientName || hasClientContact || hasContractValue
    ? 'CLIENT'
    : 'INTERNAL';
}

export function shouldCopyExpectedIncome(input: {
  expectedIncome?: string | number | null;
  contractValue?: string | number | null;
}): boolean {
  const hasExpected =
    input.expectedIncome !== null &&
    input.expectedIncome !== undefined &&
    String(input.expectedIncome).trim() !== '';
  const hasContract =
    input.contractValue !== null &&
    input.contractValue !== undefined &&
    String(input.contractValue).trim() !== '';
  return !hasExpected && hasContract;
}

export function shouldCopyCurrencyCode(input: {
  currencyCode?: string | null;
  currency?: string | null;
}): boolean {
  return !input.currencyCode?.trim() && Boolean(input.currency?.trim());
}
