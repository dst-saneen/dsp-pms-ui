export const WorkforceNotificationEventCode = {
  SHIFT_ROSTER_PUBLISHED: 'SHIFT_ROSTER_PUBLISHED',
  SHIFT_ROSTER_LOCKED: 'SHIFT_ROSTER_LOCKED',
  SHIFT_ROSTER_ARCHIVED: 'SHIFT_ROSTER_ARCHIVED',
  LEAVE_REQUEST_SUBMITTED: 'LEAVE_REQUEST_SUBMITTED',
  LEAVE_REQUEST_SUBMITTED_REQUESTER: 'LEAVE_REQUEST_SUBMITTED_REQUESTER',
  LEAVE_REQUEST_APPROVED: 'LEAVE_REQUEST_APPROVED',
  LEAVE_REQUEST_REJECTED: 'LEAVE_REQUEST_REJECTED',
  ATTENDANCE_REGULARIZATION_SUBMITTED: 'ATTENDANCE_REGULARIZATION_SUBMITTED',
  ATTENDANCE_REGULARIZATION_APPROVED: 'ATTENDANCE_REGULARIZATION_APPROVED',
  OVERTIME_REQUEST_SUBMITTED: 'OVERTIME_REQUEST_SUBMITTED',
  OVERTIME_REQUEST_APPROVED: 'OVERTIME_REQUEST_APPROVED',
  OVERTIME_REQUEST_REJECTED: 'OVERTIME_REQUEST_REJECTED',
  COMP_OFF_CREDIT_CREATED: 'COMP_OFF_CREDIT_CREATED',
  COMP_OFF_CREDIT_EXPIRED: 'COMP_OFF_CREDIT_EXPIRED',
  ATTENDANCE_PERIOD_REOPENED: 'ATTENDANCE_PERIOD_REOPENED',
  OPTIONAL_HOLIDAY_SELECTION_OPENED: 'OPTIONAL_HOLIDAY_SELECTION_OPENED',
  OPTIONAL_HOLIDAY_SELECTION_UPDATED: 'OPTIONAL_HOLIDAY_SELECTION_UPDATED',
  OPTIONAL_HOLIDAY_TOMORROW: 'OPTIONAL_HOLIDAY_TOMORROW',
} as const;

export type WorkforceNotificationEventCode =
  (typeof WorkforceNotificationEventCode)[keyof typeof WorkforceNotificationEventCode];

/** Safe display copy only — never include reasons, remarks, or private content. */
export function notificationCopy(eventCode: string): {
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
} {
  switch (eventCode) {
    case WorkforceNotificationEventCode.SHIFT_ROSTER_PUBLISHED:
      return {
        title: 'Shift roster published',
        message: 'A shift roster for your branch has been published.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.SHIFT_ROSTER_LOCKED:
      return {
        title: 'Shift roster locked',
        message: 'A shift roster has been locked and can no longer be changed.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.SHIFT_ROSTER_ARCHIVED:
      return {
        title: 'Shift roster archived',
        message: 'A shift roster has been archived.',
        priority: 'LOW',
      };
    case WorkforceNotificationEventCode.LEAVE_REQUEST_SUBMITTED:
      return {
        title: 'Leave request awaiting approval',
        message: 'A leave request is waiting for your approval.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.LEAVE_REQUEST_SUBMITTED_REQUESTER:
      return {
        title: 'Leave request submitted',
        message: 'Your leave request was submitted and is pending approval.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.LEAVE_REQUEST_APPROVED:
      return {
        title: 'Leave request approved',
        message: 'Your leave request was approved.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.LEAVE_REQUEST_REJECTED:
      return {
        title: 'Leave request rejected',
        message: 'Your leave request was rejected.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.ATTENDANCE_REGULARIZATION_SUBMITTED:
      return {
        title: 'Attendance regularization submitted',
        message: 'An attendance regularization is waiting for approval.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.ATTENDANCE_REGULARIZATION_APPROVED:
      return {
        title: 'Attendance regularization approved',
        message: 'Your attendance regularization was approved.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.OVERTIME_REQUEST_SUBMITTED:
      return {
        title: 'Overtime request submitted',
        message: 'An overtime request is waiting for approval.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.OVERTIME_REQUEST_APPROVED:
      return {
        title: 'Overtime request approved',
        message: 'Your overtime request was approved.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.OVERTIME_REQUEST_REJECTED:
      return {
        title: 'Overtime request rejected',
        message: 'Your overtime request was rejected.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.COMP_OFF_CREDIT_CREATED:
      return {
        title: 'Comp-off credit earned',
        message: 'A Comp-off credit was added to your balance.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.COMP_OFF_CREDIT_EXPIRED:
      return {
        title: 'Comp-off credit expired',
        message: 'One or more Comp-off credits have expired.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.ATTENDANCE_PERIOD_REOPENED:
      return {
        title: 'Attendance period reopened',
        message: 'An attendance period was reopened for corrections.',
        priority: 'HIGH',
      };
    case WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_SELECTION_OPENED:
      return {
        title: 'Optional holiday dates available',
        message:
          'Optional holiday dates are available. Choose your dates in My Workspace.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_SELECTION_UPDATED:
      return {
        title: 'Optional holiday selections saved',
        message: 'Your optional holiday selections were saved.',
        priority: 'NORMAL',
      };
    case WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_TOMORROW:
      return {
        title: 'Optional Holiday tomorrow',
        message:
          'You are on approved Optional Holiday tomorrow. No check-in is required.',
        priority: 'HIGH',
      };
    case 'ASSET_ASSIGNED':
      return {
        title: 'Asset assigned',
        message: 'An asset was assigned to you. Please acknowledge receipt.',
        priority: 'HIGH',
      };
    case 'ASSET_LICENSE_ALLOCATED':
      return {
        title: 'Licence allocated',
        message: 'A software licence seat was allocated to you.',
        priority: 'HIGH',
      };
    case 'ASSET_ACKNOWLEDGEMENT_PENDING':
      return {
        title: 'Asset acknowledgement pending',
        message: 'Please acknowledge an assigned asset or licence.',
        priority: 'NORMAL',
      };
    case 'ASSET_CUSTODY_REQUEST_SUBMITTED':
      return {
        title: 'Asset request submitted',
        message: 'An asset custody request is waiting for review.',
        priority: 'HIGH',
      };
    case 'ASSET_CUSTODY_REQUEST_RESOLVED':
      return {
        title: 'Asset request resolved',
        message: 'Your asset custody request was resolved.',
        priority: 'NORMAL',
      };
    case 'ASSET_TRANSFER_REQUESTED':
      return {
        title: 'Asset transfer requested',
        message: 'An asset ownership transfer is waiting for acceptance.',
        priority: 'HIGH',
      };
    case 'ASSET_TRANSFER_ACCEPTED':
      return {
        title: 'Asset transfer accepted',
        message: 'An asset ownership transfer was accepted.',
        priority: 'NORMAL',
      };
    case 'ASSET_TRANSFER_REJECTED':
      return {
        title: 'Asset transfer rejected',
        message: 'An asset ownership transfer was rejected.',
        priority: 'NORMAL',
      };
    case 'ASSET_EXPIRY_ATTENTION':
      return {
        title: 'Asset expiry attention',
        message: 'An asset, card, or licence is approaching expiry.',
        priority: 'HIGH',
      };
    case 'ASSET_LICENSE_CAPACITY_LOW':
      return {
        title: 'Licence capacity low',
        message: 'A software licence pool is running low on seats.',
        priority: 'HIGH',
      };
    case 'ASSET_LICENSE_CAPACITY_FULL':
      return {
        title: 'Licence pool full',
        message: 'A software licence pool has no remaining seats.',
        priority: 'HIGH',
      };
    case 'ASSET_CLEARANCE_WAIVER_REQUESTED':
      return {
        title: 'Asset clearance waiver requested',
        message: 'An asset clearance waiver is waiting for approval.',
        priority: 'HIGH',
      };
    case 'ASSET_CLEARANCE_WAIVER_APPROVED':
      return {
        title: 'Asset clearance waiver approved',
        message: 'An asset clearance waiver was approved.',
        priority: 'NORMAL',
      };
    case 'ASSET_CLEARANCE_WAIVER_REJECTED':
      return {
        title: 'Asset clearance waiver rejected',
        message: 'An asset clearance waiver was rejected.',
        priority: 'HIGH',
      };
    case 'HR_REQUEST_CREATED':
      return {
        title: 'HR request created',
        message: 'Your HR request was created.',
        priority: 'NORMAL',
      };
    case 'HR_REQUEST_APPROVAL_REQUIRED':
      return {
        title: 'HR request awaiting review',
        message: 'An HR request is ready for your review.',
        priority: 'HIGH',
      };
    case 'HR_REQUEST_COMPLETED':
      return {
        title: 'HR request completed',
        message: 'Your HR request was completed.',
        priority: 'NORMAL',
      };
    case 'HR_REQUEST_CANCELLED':
      return {
        title: 'HR request cancelled',
        message: 'Your HR request was cancelled.',
        priority: 'NORMAL',
      };
    case 'HR_REQUEST_APPROVED':
      return {
        title: 'HR request approved',
        message: 'Your HR request was approved.',
        priority: 'NORMAL',
      };
    case 'HR_REQUEST_REJECTED':
      return {
        title: 'HR request rejected',
        message: 'Your HR request was rejected.',
        priority: 'HIGH',
      };
    case 'EMPLOYEE_SEPARATION_CREATED':
      return {
        title: 'Employee separation created',
        message: 'An employee separation is ready for review.',
        priority: 'HIGH',
      };
    case 'EMPLOYEE_SEPARATION_APPROVED':
      return {
        title: 'Employee separation approved',
        message: 'An employee separation was approved.',
        priority: 'HIGH',
      };
    case 'EMPLOYEE_SEPARATION_APPROVAL_ADVANCED':
      return {
        title: 'Employee separation awaiting approval',
        message: 'An employee separation is waiting for your approval.',
        priority: 'HIGH',
      };
    case 'EMPLOYEE_SEPARATION_REJECTED':
      return {
        title: 'Employee separation rejected',
        message: 'An employee separation was rejected.',
        priority: 'HIGH',
      };
    case 'EMPLOYEE_SEPARATION_CANCELLED':
      return {
        title: 'Employee separation cancelled',
        message: 'An employee separation was cancelled.',
        priority: 'NORMAL',
      };
    case 'EMPLOYEE_SEPARATION_COMPLETED':
      return {
        title: 'Employee separation completed',
        message: 'An employee separation was completed.',
        priority: 'NORMAL',
      };
    case 'EMPLOYEE_CLEARANCE_ITEM_CLEARED':
      return {
        title: 'Clearance item completed',
        message: 'An employee clearance item was completed.',
        priority: 'NORMAL',
      };
    case 'EMPLOYEE_CLEARANCE_ITEM_REOPENED':
      return {
        title: 'Clearance item reopened',
        message: 'An employee clearance item was reopened.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_TASK_DUE_SOON':
      return {
        title: 'Onboarding task due soon',
        message: 'An onboarding task assigned to you is due within two days.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_TASK_OVERDUE':
      return {
        title: 'Onboarding task overdue',
        message: 'An onboarding task assigned to you is overdue.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_TASK_ASSIGNED':
    case 'ONBOARDING_TASK_REASSIGNED':
      return {
        title: 'Onboarding task assigned',
        message: 'An onboarding task was assigned to you.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_TASK_UNASSIGNED':
      return {
        title: 'Onboarding task unassigned',
        message: 'An onboarding task is no longer assigned to you.',
        priority: 'NORMAL',
      };
    case 'ONBOARDING_TASK_COMPLETED':
      return {
        title: 'Onboarding task completed',
        message: 'An onboarding task was marked complete.',
        priority: 'NORMAL',
      };
    case 'ONBOARDING_TASK_WAIVED':
      return {
        title: 'Onboarding task waived',
        message: 'An onboarding task was waived.',
        priority: 'NORMAL',
      };
    case 'ONBOARDING_STARTED':
      return {
        title: 'Onboarding started',
        message: 'Employee onboarding has started.',
        priority: 'NORMAL',
      };
    case 'ONBOARDING_COMPLETED':
      return {
        title: 'Onboarding completed',
        message: 'Employee onboarding was completed.',
        priority: 'NORMAL',
      };
    case 'ONBOARDING_CANCELLED':
      return {
        title: 'Onboarding cancelled',
        message: 'Employee onboarding was cancelled.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_DEPARTMENT_WORK_AVAILABLE':
      return {
        title: 'Onboarding department work available',
        message: 'New onboarding work is available for your department.',
        priority: 'HIGH',
      };
    case 'ONBOARDING_DEPARTMENT_NO_ASSIGNER':
      return {
        title: 'Onboarding needs an assigner',
        message: 'Department onboarding work has no assigner configured.',
        priority: 'HIGH',
      };
    case 'projects.project.activated':
      return {
        title: 'Project activated',
        message: 'A project was activated.',
        priority: 'NORMAL',
      };
    case 'projects.project.held':
      return {
        title: 'Project on hold',
        message: 'A project was put on hold.',
        priority: 'NORMAL',
      };
    case 'projects.project.resumed':
      return {
        title: 'Project resumed',
        message: 'A project was resumed.',
        priority: 'NORMAL',
      };
    case 'projects.project.completed':
      return {
        title: 'Project completed',
        message: 'A project was completed.',
        priority: 'NORMAL',
      };
    case 'projects.project.cancelled':
      return {
        title: 'Project cancelled',
        message: 'A project was cancelled.',
        priority: 'NORMAL',
      };
    case 'projects.team.member.added':
      return {
        title: 'Added to project team',
        message: 'You were added to a project team.',
        priority: 'HIGH',
      };
    case 'projects.team.member.ended':
      return {
        title: 'Project team membership ended',
        message: 'Your project team membership ended.',
        priority: 'NORMAL',
      };
    case 'projects.task.assigned':
    case 'projects.task.reassigned':
      return {
        title: 'Project task assigned',
        message: 'A project task was assigned to you.',
        priority: 'HIGH',
      };
    case 'projects.task.submitted':
      return {
        title: 'Project task submitted',
        message: 'A project task was submitted for review.',
        priority: 'HIGH',
      };
    case 'projects.task.returned':
      return {
        title: 'Project task returned',
        message: 'A project task was returned.',
        priority: 'HIGH',
      };
    case 'projects.task.completed':
      return {
        title: 'Project task completed',
        message: 'A project task was completed.',
        priority: 'NORMAL',
      };
    case 'projects.task.due_soon':
      return {
        title: 'Project task due soon',
        message: 'A project task is due soon.',
        priority: 'HIGH',
      };
    case 'projects.task.overdue':
      return {
        title: 'Project task overdue',
        message: 'A project task is overdue.',
        priority: 'HIGH',
      };
    case 'projects.timesheet.submitted':
      return {
        title: 'Timesheet awaits approval',
        message: 'A timesheet awaits your approval.',
        priority: 'HIGH',
      };
    case 'projects.timesheet.returned':
      return {
        title: 'Timesheet returned',
        message: 'Your timesheet was returned.',
        priority: 'HIGH',
      };
    case 'projects.timesheet.approved':
      return {
        title: 'Timesheet approved',
        message: 'Your timesheet was approved.',
        priority: 'NORMAL',
      };
    case 'projects.timesheet.cancelled':
      return {
        title: 'Timesheet cancelled',
        message: 'A timesheet was cancelled.',
        priority: 'NORMAL',
      };
    case 'office-finance.transaction.submitted':
      return {
        title: 'Finance approval required',
        message: 'A finance transaction is waiting for your approval.',
        priority: 'HIGH',
      };
    case 'office-finance.transaction.approved':
      return {
        title: 'Finance transaction approved',
        message: 'Your finance transaction was approved.',
        priority: 'NORMAL',
      };
    case 'office-finance.transaction.returned':
      return {
        title: 'Finance transaction returned',
        message: 'Your finance transaction was returned.',
        priority: 'HIGH',
      };
    case 'office-finance.transaction.cancelled':
      return {
        title: 'Finance transaction cancelled',
        message: 'Your finance transaction was cancelled.',
        priority: 'NORMAL',
      };
    case 'office-finance.transaction.reversed':
      return {
        title: 'Finance transaction reversed',
        message: 'Your finance transaction was reversed.',
        priority: 'HIGH',
      };
    case 'office-finance.period.locked':
      return {
        title: 'Finance period locked',
        message: 'A finance period was locked.',
        priority: 'HIGH',
      };
    case 'office-finance.period.reopened':
      return {
        title: 'Finance period reopened',
        message: 'A finance period was reopened.',
        priority: 'HIGH',
      };
    case 'payroll.payslip.available':
      return {
        title: 'Payslip available',
        message: 'Your payslip is available.',
        priority: 'NORMAL',
      };
    case 'recruitment.application.received':
      return {
        title: 'New job application received',
        message: 'A candidate submitted an application.',
        priority: 'NORMAL',
      };
    case 'recruitment.interview.scheduled':
      return {
        title: 'Interview scheduled',
        message: 'An interview has been scheduled.',
        priority: 'NORMAL',
      };
    case 'recruitment.interview.rescheduled':
      return {
        title: 'Interview updated',
        message: 'An interview was rescheduled.',
        priority: 'NORMAL',
      };
    case 'recruitment.interview.cancelled':
      return {
        title: 'Interview cancelled',
        message: 'An interview was cancelled.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.sent':
      return {
        title: 'Offer sent',
        message: 'An employment offer was sent to a candidate.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.accepted':
      return {
        title: 'Offer accepted',
        message: 'A candidate accepted an employment offer.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.declined':
      return {
        title: 'Offer declined',
        message: 'A candidate declined an employment offer.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.signature.submitted':
      return {
        title: 'Signed offer submitted',
        message: 'A candidate submitted a signed offer for verification.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.signature.verified':
      return {
        title: 'Signed offer verified',
        message: 'Your signed offer has been verified.',
        priority: 'HIGH',
      };
    case 'recruitment.offer.signature.rejected':
      return {
        title: 'Signed offer needs resubmission',
        message: 'Your signed offer needs to be resubmitted.',
        priority: 'HIGH',
      };
    case 'recruitment.conversion.completed':
      return {
        title: 'Candidate converted',
        message: 'A candidate was converted to an employee.',
        priority: 'HIGH',
      };
    default:
      return {
        title: 'Workforce update',
        message: 'There is a new workforce update for you.',
        priority: 'LOW',
      };
  }
}
