import { DeliveryChannel } from '@prisma/client';

import { OFFICE_FINANCE_DELIVERY_EVENTS } from '../../office-finance/office-finance-delivery.events';

export const OFFER_SIGNATURE_EVENTS = {
  SUBMITTED: 'recruitment.offer.signature.submitted',
  VERIFIED: 'recruitment.offer.signature.verified',
  REJECTED: 'recruitment.offer.signature.rejected',
  RESUBMISSION: 'recruitment.offer.signature.resubmission.requested',
} as const;

export const ONBOARDING_DELIVERY_EVENTS = {
  STARTED: 'ONBOARDING_STARTED',
  DEPARTMENT_WORK_AVAILABLE: 'ONBOARDING_DEPARTMENT_WORK_AVAILABLE',
  DEPARTMENT_NO_ASSIGNER: 'ONBOARDING_DEPARTMENT_NO_ASSIGNER',
  TASK_ASSIGNED: 'ONBOARDING_TASK_ASSIGNED',
  TASK_REASSIGNED: 'ONBOARDING_TASK_REASSIGNED',
  TASK_UNASSIGNED: 'ONBOARDING_TASK_UNASSIGNED',
  TASK_DUE_SOON: 'ONBOARDING_TASK_DUE_SOON',
  TASK_OVERDUE: 'ONBOARDING_TASK_OVERDUE',
  TASK_COMPLETED: 'ONBOARDING_TASK_COMPLETED',
  TASK_WAIVED: 'ONBOARDING_TASK_WAIVED',
  CANCELLED: 'ONBOARDING_CANCELLED',
  COMPLETED: 'ONBOARDING_COMPLETED',
} as const;

export type DeliveryHandlerKind =
  | 'RECRUITMENT_APPLICATION'
  | 'RECRUITMENT_INTERVIEW'
  | 'RECRUITMENT_OFFER'
  | 'RECRUITMENT_SIGNATURE'
  | 'RECRUITMENT_INVITATION'
  | 'ONBOARDING_TASK'
  | 'ONBOARDING'
  | 'PROJECT'
  | 'PAYROLL_PAYSLIP'
  | 'OFFICE_FINANCE'
  | 'WORKFORCE_NOTIFICATION';

export type FinanceDeliveryRecipientRule =
  'TRANSACTION_APPROVERS' | 'TRANSACTION_OWNER' | 'FINANCE_OPERATIONS';

export interface DeliveryEventDefinition {
  handlerKind: DeliveryHandlerKind;
  subject: string;
  hrPermission?: string;
  allowGlobal?: boolean;
  candidateChannels?: DeliveryChannel[];
  panelChannels?: DeliveryChannel[];
  hrChannels?: DeliveryChannel[];
  assigneeChannels?: DeliveryChannel[];
  employeeChannels?: DeliveryChannel[];
  departmentPermission?: string;
  departmentChannels?: DeliveryChannel[];
  financeRecipientRule?: FinanceDeliveryRecipientRule;
}

const EMAIL = [DeliveryChannel.EMAIL] as const;
const IN_APP = [DeliveryChannel.IN_APP] as const;
const EMAIL_AND_IN_APP = [
  DeliveryChannel.EMAIL,
  DeliveryChannel.IN_APP,
] as const;

const DELIVERY_EVENT_REGISTRY_BASE: Record<string, DeliveryEventDefinition> = {
  'recruitment.application.received': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'We received your application',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.application.shortlisted': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'Your application has been shortlisted',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.interview.scheduled': {
    handlerKind: 'RECRUITMENT_INTERVIEW',
    subject: 'Your interview has been scheduled',
    candidateChannels: [...EMAIL],
    panelChannels: [...EMAIL_AND_IN_APP],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.interview.rescheduled': {
    handlerKind: 'RECRUITMENT_INTERVIEW',
    subject: 'Your interview has been rescheduled',
    candidateChannels: [...EMAIL],
    panelChannels: [...EMAIL_AND_IN_APP],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.interview.cancelled': {
    handlerKind: 'RECRUITMENT_INTERVIEW',
    subject: 'Your interview has been cancelled',
    candidateChannels: [...EMAIL],
    panelChannels: [...EMAIL_AND_IN_APP],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.evaluation.due': {
    handlerKind: 'RECRUITMENT_INTERVIEW',
    subject: 'Interview evaluation is due',
    panelChannels: [...IN_APP],
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.manager.decision.due': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'A hiring decision is due',
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  'recruitment.offer.sent': {
    handlerKind: 'RECRUITMENT_OFFER',
    subject: 'You have received an offer',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  'recruitment.offer.accepted': {
    handlerKind: 'RECRUITMENT_OFFER',
    subject: 'Offer accepted confirmation',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  'recruitment.offer.declined': {
    handlerKind: 'RECRUITMENT_OFFER',
    subject: 'Offer response recorded',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  [OFFER_SIGNATURE_EVENTS.SUBMITTED]: {
    handlerKind: 'RECRUITMENT_SIGNATURE',
    subject: 'Signed offer submitted for verification',
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  [OFFER_SIGNATURE_EVENTS.VERIFIED]: {
    handlerKind: 'RECRUITMENT_SIGNATURE',
    subject: 'Your offer has been verified',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  [OFFER_SIGNATURE_EVENTS.REJECTED]: {
    handlerKind: 'RECRUITMENT_SIGNATURE',
    subject: 'Your signed offer needs to be resubmitted',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  [OFFER_SIGNATURE_EVENTS.RESUBMISSION]: {
    handlerKind: 'RECRUITMENT_SIGNATURE',
    subject: 'Please resubmit your signed offer letter',
    candidateChannels: [...EMAIL],
    hrPermission: 'hr.recruitment.offer',
    hrChannels: [...IN_APP],
  },
  'recruitment.ready_to_hire': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'Candidate is ready to hire',
    hrPermission: 'hr.recruitment.convert',
    hrChannels: [...IN_APP],
  },
  'recruitment.conversion.completed': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'Candidate conversion completed',
    hrPermission: 'hr.recruitment.convert',
    hrChannels: [...IN_APP],
  },
  'recruitment.employee.invitation': {
    handlerKind: 'RECRUITMENT_INVITATION',
    subject: 'You are invited to Group ERP',
    candidateChannels: [...EMAIL],
  },
  'recruitment.probation.due': {
    handlerKind: 'RECRUITMENT_APPLICATION',
    subject: 'Probation review is due',
    hrPermission: 'hr.recruitment.manage',
    hrChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_ASSIGNED]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task was assigned to you',
    assigneeChannels: [...EMAIL_AND_IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_REASSIGNED]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task was reassigned to you',
    assigneeChannels: [...EMAIL_AND_IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_DUE_SOON]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task is due soon',
    assigneeChannels: [...EMAIL_AND_IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_OVERDUE]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task is overdue',
    assigneeChannels: [...EMAIL_AND_IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_UNASSIGNED]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task is unassigned',
    departmentPermission: 'hr.onboarding.department.assign',
    departmentChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_COMPLETED]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task was completed',
    assigneeChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.TASK_WAIVED]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'An onboarding task was waived',
    assigneeChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.STARTED]: {
    handlerKind: 'ONBOARDING',
    subject: 'Onboarding has started',
    employeeChannels: [...EMAIL_AND_IN_APP],
    hrPermission: 'hr.onboarding.manage',
    hrChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.COMPLETED]: {
    handlerKind: 'ONBOARDING',
    subject: 'Onboarding is complete',
    employeeChannels: [...IN_APP],
    hrPermission: 'hr.onboarding.manage',
    hrChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.CANCELLED]: {
    handlerKind: 'ONBOARDING',
    subject: 'Onboarding was cancelled',
    employeeChannels: [...IN_APP],
    hrPermission: 'hr.onboarding.manage',
    hrChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.DEPARTMENT_WORK_AVAILABLE]: {
    handlerKind: 'ONBOARDING_TASK',
    subject: 'Department onboarding work is available',
    departmentPermission: 'hr.onboarding.department.assign',
    departmentChannels: [...IN_APP],
  },
  [ONBOARDING_DELIVERY_EVENTS.DEPARTMENT_NO_ASSIGNER]: {
    handlerKind: 'ONBOARDING',
    subject: 'No department assigner is available',
    hrPermission: 'hr.onboarding.manage',
    hrChannels: [...IN_APP],
  },

  'projects.project.activated': {
    handlerKind: 'PROJECT',
    subject: 'A project was activated',
    employeeChannels: [...IN_APP],
  },
  'projects.project.held': {
    handlerKind: 'PROJECT',
    subject: 'A project was put on hold',
    employeeChannels: [...IN_APP],
  },
  'projects.project.resumed': {
    handlerKind: 'PROJECT',
    subject: 'A project was resumed',
    employeeChannels: [...IN_APP],
  },
  'projects.project.completed': {
    handlerKind: 'PROJECT',
    subject: 'A project was completed',
    employeeChannels: [...IN_APP],
  },
  'projects.project.cancelled': {
    handlerKind: 'PROJECT',
    subject: 'A project was cancelled',
    employeeChannels: [...IN_APP],
  },
  'projects.team.member.added': {
    handlerKind: 'PROJECT',
    subject: 'You were added to a project team',
    employeeChannels: [...IN_APP],
  },
  'projects.team.member.ended': {
    handlerKind: 'PROJECT',
    subject: 'Your project team membership ended',
    employeeChannels: [...IN_APP],
  },
  'projects.task.assigned': {
    handlerKind: 'PROJECT',
    subject: 'A project task was assigned to you',
    assigneeChannels: [...IN_APP],
  },
  'projects.task.reassigned': {
    handlerKind: 'PROJECT',
    subject: 'A project task was reassigned',
    assigneeChannels: [...IN_APP],
  },
  'projects.task.submitted': {
    handlerKind: 'PROJECT',
    subject: 'A project task was submitted for review',
    employeeChannels: [...IN_APP],
  },
  'projects.task.returned': {
    handlerKind: 'PROJECT',
    subject: 'A project task was returned',
    assigneeChannels: [...IN_APP],
  },
  'projects.task.completed': {
    handlerKind: 'PROJECT',
    subject: 'A project task was completed',
    assigneeChannels: [...IN_APP],
  },
  'projects.task.due_soon': {
    handlerKind: 'PROJECT',
    subject: 'A project task is due soon',
    assigneeChannels: [...IN_APP],
  },
  'projects.task.overdue': {
    handlerKind: 'PROJECT',
    subject: 'A project task is overdue',
    assigneeChannels: [...IN_APP],
  },
  'projects.timesheet.submitted': {
    handlerKind: 'PROJECT',
    subject: 'A timesheet awaits your approval',
    employeeChannels: [...IN_APP],
  },
  'projects.timesheet.returned': {
    handlerKind: 'PROJECT',
    subject: 'Your timesheet was returned',
    employeeChannels: [...IN_APP],
  },
  'projects.timesheet.approved': {
    handlerKind: 'PROJECT',
    subject: 'Your timesheet was approved',
    employeeChannels: [...IN_APP],
  },
  'projects.timesheet.cancelled': {
    handlerKind: 'PROJECT',
    subject: 'A timesheet was cancelled',
    employeeChannels: [...IN_APP],
  },
  'payroll.payslip.available': {
    handlerKind: 'PAYROLL_PAYSLIP',
    subject: 'Your payslip is available',
    employeeChannels: [...EMAIL_AND_IN_APP],
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_SUBMITTED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'A finance transaction is awaiting approval',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'TRANSACTION_APPROVERS',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_APPROVED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'Your finance transaction was approved',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'TRANSACTION_OWNER',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_RETURNED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'Your finance transaction was returned',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'TRANSACTION_OWNER',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_CANCELLED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'Your finance transaction was cancelled',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'TRANSACTION_OWNER',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_REVERSED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'Your finance transaction was reversed',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'TRANSACTION_OWNER',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_LOCKED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'A finance period was locked',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'FINANCE_OPERATIONS',
  },
  [OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_REOPENED]: {
    handlerKind: 'OFFICE_FINANCE',
    subject: 'A finance period was reopened',
    employeeChannels: [...IN_APP],
    financeRecipientRule: 'FINANCE_OPERATIONS',
  },
};

/**
 * Explicit allowlist for user-facing workforce notifications. Internal domain
 * events must not be added unless they have a supported recipient contract.
 */
const WORKFORCE_NOTIFICATION_SUBJECTS = {
  SHIFT_ROSTER_PUBLISHED: 'A shift roster was published',
  SHIFT_ROSTER_LOCKED: 'A shift roster was locked',
  SHIFT_ROSTER_ARCHIVED: 'A shift roster was archived',
  LEAVE_REQUEST_SUBMITTED: 'A leave request is awaiting approval',
  LEAVE_REQUEST_SUBMITTED_REQUESTER: 'Your leave request was submitted',
  LEAVE_REQUEST_APPROVED: 'Your leave request was approved',
  LEAVE_REQUEST_REJECTED: 'Your leave request was rejected',
  ATTENDANCE_REGULARIZATION_SUBMITTED:
    'An attendance regularization is awaiting approval',
  ATTENDANCE_REGULARIZATION_APPROVED:
    'Your attendance regularization was approved',
  OVERTIME_REQUEST_SUBMITTED: 'An overtime request is awaiting approval',
  OVERTIME_REQUEST_APPROVED: 'Your overtime request was approved',
  OVERTIME_REQUEST_REJECTED: 'Your overtime request was rejected',
  COMP_OFF_CREDIT_CREATED: 'A Comp-off credit was added',
  COMP_OFF_CREDIT_EXPIRED: 'A Comp-off credit expired',
  ATTENDANCE_PERIOD_REOPENED: 'An attendance period was reopened',
  OPTIONAL_HOLIDAY_SELECTION_OPENED:
    'Optional holiday selections are available',
  OPTIONAL_HOLIDAY_SELECTION_UPDATED:
    'Your optional holiday selections were updated',
  OPTIONAL_HOLIDAY_TOMORROW: 'Optional Holiday reminder',
  ASSET_ASSIGNED: 'An asset was assigned to you',
  ASSET_LICENSE_ALLOCATED: 'A licence was allocated to you',
  ASSET_ACKNOWLEDGEMENT_PENDING: 'Asset acknowledgement is pending',
  ASSET_CUSTODY_REQUEST_SUBMITTED:
    'An asset custody request is awaiting review',
  ASSET_CUSTODY_REQUEST_RESOLVED: 'Your asset custody request was resolved',
  ASSET_TRANSFER_REQUESTED: 'An asset transfer is awaiting acceptance',
  ASSET_TRANSFER_ACCEPTED: 'An asset transfer was accepted',
  ASSET_TRANSFER_REJECTED: 'An asset transfer was rejected',
  ASSET_EXPIRY_ATTENTION: 'An asset requires expiry attention',
  ASSET_LICENSE_CAPACITY_LOW: 'Licence capacity is low',
  ASSET_LICENSE_CAPACITY_FULL: 'A licence pool is full',
  ASSET_CLEARANCE_WAIVER_REQUESTED:
    'An asset clearance waiver is awaiting approval',
  ASSET_CLEARANCE_WAIVER_APPROVED: 'An asset clearance waiver was approved',
  ASSET_CLEARANCE_WAIVER_REJECTED: 'An asset clearance waiver was rejected',
  HR_REQUEST_CREATED: 'Your HR request was created',
  HR_REQUEST_APPROVAL_REQUIRED: 'An HR request is awaiting approval',
  HR_REQUEST_COMPLETED: 'Your HR request was completed',
  HR_REQUEST_CANCELLED: 'Your HR request was cancelled',
  HR_REQUEST_APPROVED: 'Your HR request was approved',
  HR_REQUEST_REJECTED: 'Your HR request was rejected',
  EMPLOYEE_SEPARATION_CREATED: 'An employee separation was created',
  EMPLOYEE_SEPARATION_APPROVED: 'An employee separation was approved',
  EMPLOYEE_SEPARATION_APPROVAL_ADVANCED:
    'An employee separation is awaiting your approval',
  EMPLOYEE_SEPARATION_REJECTED: 'An employee separation was rejected',
  EMPLOYEE_SEPARATION_CANCELLED: 'An employee separation was cancelled',
  EMPLOYEE_SEPARATION_COMPLETED: 'An employee separation was completed',
  EMPLOYEE_CLEARANCE_ITEM_CLEARED: 'A clearance item was completed',
  EMPLOYEE_CLEARANCE_ITEM_REOPENED: 'A clearance item was reopened',
} as const;

const WORKFORCE_NOTIFICATION_DEFINITIONS = Object.fromEntries(
  Object.entries(WORKFORCE_NOTIFICATION_SUBJECTS).map(
    ([eventType, subject]) => [
      eventType,
      {
        handlerKind: 'WORKFORCE_NOTIFICATION' as const,
        subject,
        employeeChannels: [...EMAIL_AND_IN_APP],
      },
    ],
  ),
) satisfies Record<string, DeliveryEventDefinition>;

function addEmailToInAppChannels(
  channels: DeliveryChannel[] | undefined,
): DeliveryChannel[] | undefined {
  if (!channels?.includes(DeliveryChannel.IN_APP)) {
    return channels;
  }
  return channels.includes(DeliveryChannel.EMAIL)
    ? channels
    : [DeliveryChannel.EMAIL, ...channels];
}

function withWorkforceEmailPolicy(
  definitions: Record<string, DeliveryEventDefinition>,
): Record<string, DeliveryEventDefinition> {
  return Object.fromEntries(
    Object.entries(definitions).map(([eventType, definition]) => [
      eventType,
      {
        ...definition,
        candidateChannels: addEmailToInAppChannels(
          definition.candidateChannels,
        ),
        panelChannels: addEmailToInAppChannels(definition.panelChannels),
        hrChannels: addEmailToInAppChannels(definition.hrChannels),
        assigneeChannels: addEmailToInAppChannels(definition.assigneeChannels),
        employeeChannels: addEmailToInAppChannels(definition.employeeChannels),
        departmentChannels: addEmailToInAppChannels(
          definition.departmentChannels,
        ),
      },
    ]),
  );
}

export const DELIVERY_EVENT_REGISTRY = withWorkforceEmailPolicy({
  ...DELIVERY_EVENT_REGISTRY_BASE,
  ...WORKFORCE_NOTIFICATION_DEFINITIONS,
});

export function getDeliveryEventDefinition(
  eventType: string,
): DeliveryEventDefinition | undefined {
  return DELIVERY_EVENT_REGISTRY[eventType];
}

/** True when the registry declares EMAIL for any recipient role. */
export function deliveryEventDefinesEmailChannel(eventType: string): boolean {
  const definition = getDeliveryEventDefinition(eventType);
  if (!definition) {
    return false;
  }

  const channelLists = [
    definition.candidateChannels,
    definition.panelChannels,
    definition.hrChannels,
    definition.assigneeChannels,
    definition.employeeChannels,
    definition.departmentChannels,
  ];

  return channelLists.some((channels) =>
    Boolean(channels?.includes(DeliveryChannel.EMAIL)),
  );
}

/** Whether the legacy outbox path should also send SMTP for this event. */
export function legacyOutboxShouldSendEmail(eventType: string): boolean {
  if (eventType.startsWith('recruitment.')) {
    // Recruitment keeps its own legacy mail processor.
    return false;
  }
  return deliveryEventDefinesEmailChannel(eventType);
}
