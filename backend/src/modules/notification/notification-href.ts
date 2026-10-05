/**
 * Safe in-app deep links for user notifications.
 * Returns null when no authorized destination is known.
 */
export function resolveNotificationHref(
  eventCode: string,
  entityType?: string | null,
  entityId?: string | null,
): string | null {
  const id = entityId?.trim() || null;

  switch (eventCode) {
    case 'LEAVE_REQUEST_SUBMITTED':
      return id ? `/hr/leave?requestId=${encodeURIComponent(id)}` : '/hr/leave';
    case 'LEAVE_REQUEST_SUBMITTED_REQUESTER':
    case 'LEAVE_REQUEST_APPROVED':
    case 'LEAVE_REQUEST_REJECTED':
      return '/my-workspace/leave';
    case 'HR_REQUEST_CREATED':
      return '/my-workspace/hr-requests';
    case 'HR_REQUEST_APPROVAL_REQUIRED':
      return '/hr/hr-requests';
    case 'HR_REQUEST_COMPLETED':
    case 'HR_REQUEST_CANCELLED':
    case 'HR_REQUEST_APPROVED':
    case 'HR_REQUEST_REJECTED':
      return '/my-workspace/hr-requests';
    case 'EMPLOYEE_SEPARATION_CREATED':
    case 'EMPLOYEE_SEPARATION_APPROVED':
    case 'EMPLOYEE_SEPARATION_APPROVAL_ADVANCED':
    case 'EMPLOYEE_SEPARATION_REJECTED':
    case 'EMPLOYEE_SEPARATION_CANCELLED':
    case 'EMPLOYEE_SEPARATION_COMPLETED':
    case 'EMPLOYEE_CLEARANCE_ITEM_CLEARED':
    case 'EMPLOYEE_CLEARANCE_ITEM_REOPENED':
      return id
        ? `/hr/employee-separations/${encodeURIComponent(id)}`
        : '/hr/employee-separations';
    case 'ATTENDANCE_REGULARIZATION_SUBMITTED':
      return '/hr/attendance';
    case 'ATTENDANCE_REGULARIZATION_APPROVED':
    case 'ATTENDANCE_PERIOD_REOPENED':
      return '/my-workspace';
    case 'OVERTIME_REQUEST_SUBMITTED':
      return id
        ? `/hr/overtime?requestId=${encodeURIComponent(id)}`
        : '/hr/overtime';
    case 'OVERTIME_REQUEST_APPROVED':
    case 'OVERTIME_REQUEST_REJECTED':
    case 'COMP_OFF_CREDIT_CREATED':
    case 'COMP_OFF_CREDIT_EXPIRED':
      return '/my-workspace';
    case 'OPTIONAL_HOLIDAY_SELECTION_OPENED':
    case 'OPTIONAL_HOLIDAY_SELECTION_UPDATED':
    case 'OPTIONAL_HOLIDAY_TOMORROW':
      return '/my-workspace';
    case 'SHIFT_ROSTER_PUBLISHED':
    case 'SHIFT_ROSTER_LOCKED':
    case 'SHIFT_ROSTER_ARCHIVED':
      return '/my-workspace';
    case 'ASSET_ASSIGNED':
    case 'ASSET_LICENSE_ALLOCATED':
    case 'ASSET_ACKNOWLEDGEMENT_PENDING':
    case 'ASSET_CUSTODY_REQUEST_RESOLVED':
      return '/my-workspace';
    case 'ASSET_CUSTODY_REQUEST_SUBMITTED':
    case 'ASSET_TRANSFER_REQUESTED':
    case 'ASSET_TRANSFER_ACCEPTED':
    case 'ASSET_TRANSFER_REJECTED':
    case 'ASSET_EXPIRY_ATTENTION':
    case 'ASSET_LICENSE_CAPACITY_LOW':
    case 'ASSET_LICENSE_CAPACITY_FULL':
    case 'ASSET_CLEARANCE_WAIVER_REQUESTED':
    case 'ASSET_CLEARANCE_WAIVER_APPROVED':
    case 'ASSET_CLEARANCE_WAIVER_REJECTED':
      return '/asset-management/assets';
    case 'ONBOARDING_TASK_DUE_SOON':
    case 'ONBOARDING_TASK_OVERDUE':
    case 'ONBOARDING_TASK_ASSIGNED':
    case 'ONBOARDING_TASK_REASSIGNED':
    case 'ONBOARDING_TASK_UNASSIGNED':
    case 'ONBOARDING_TASK_COMPLETED':
    case 'ONBOARDING_TASK_WAIVED':
    case 'ONBOARDING_STARTED':
    case 'ONBOARDING_COMPLETED':
    case 'ONBOARDING_CANCELLED':
    case 'ONBOARDING_DEPARTMENT_WORK_AVAILABLE':
    case 'ONBOARDING_DEPARTMENT_NO_ASSIGNER':
      return '/my-workspace/onboarding';
    case 'projects.project.activated':
    case 'projects.project.held':
    case 'projects.project.resumed':
    case 'projects.project.completed':
    case 'projects.project.cancelled':
    case 'projects.team.member.added':
    case 'projects.team.member.ended':
    case 'projects.task.assigned':
    case 'projects.task.reassigned':
    case 'projects.task.submitted':
    case 'projects.task.returned':
    case 'projects.task.completed':
    case 'projects.task.due_soon':
    case 'projects.task.overdue':
    case 'projects.timesheet.submitted':
    case 'projects.timesheet.returned':
    case 'projects.timesheet.approved':
    case 'projects.timesheet.cancelled':
      return '/my-workspace/projects';
    case 'office-finance.transaction.submitted':
    case 'office-finance.transaction.approved':
    case 'office-finance.transaction.returned':
    case 'office-finance.transaction.cancelled':
    case 'office-finance.transaction.reversed':
      return id
        ? `/office-finance/transactions/${encodeURIComponent(id)}`
        : '/office-finance/transactions';
    case 'office-finance.period.locked':
    case 'office-finance.period.reopened':
      return '/office-finance';
    case 'recruitment.application.received':
      return id
        ? `/hr/recruitment/applications/${encodeURIComponent(id)}`
        : '/hr/recruitment/applications';
    case 'recruitment.interview.scheduled':
    case 'recruitment.interview.rescheduled':
    case 'recruitment.interview.cancelled':
      return '/hr/recruitment/interviews';
    case 'recruitment.offer.sent':
    case 'recruitment.offer.accepted':
    case 'recruitment.offer.declined':
    case 'recruitment.offer.signature.submitted':
    case 'recruitment.offer.signature.verified':
    case 'recruitment.offer.signature.rejected':
      return '/hr/recruitment/offers';
    case 'recruitment.conversion.completed':
      return '/hr/employees';
    case 'payroll.payslip.available':
      return '/my-workspace';
    default:
      if (entityType === 'LeaveRequest') {
        return '/my-workspace/leave';
      }
      if (entityType === 'JobApplication' && id) {
        return `/hr/recruitment/applications/${encodeURIComponent(id)}`;
      }
      if (entityType === 'PayrollPayslip') {
        return '/my-workspace';
      }
      return null;
  }
}
