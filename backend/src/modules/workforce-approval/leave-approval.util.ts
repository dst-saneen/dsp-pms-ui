import type { ApprovalWorkflowStep } from '@prisma/client';

export type LeaveApprovalStepName = 'REPORTING_MANAGER' | 'HR' | 'OTHER';

/** Roles that may act on the leave HR step when scoped to the subject employee. */
export const LEAVE_HR_ACTOR_ROLE_CODES = [
  'HR_MANAGER',
  'COMPANY_ADMINISTRATOR',
  'ORGANIZATION_OWNER',
] as const;

export type LeaveApprovalStepSnapshot = {
  stepNo: number;
  name: LeaveApprovalStepName;
  label: string;
  approverId: string | null;
  status: 'PENDING' | 'SKIPPED';
};

export function isLeaveManagerWorkflowStep(
  step: Pick<ApprovalWorkflowStep, 'approverType'>,
): boolean {
  return step.approverType.trim().toUpperCase() === 'REPORTING_MANAGER';
}

export function isLeaveHrWorkflowStep(
  step: Pick<ApprovalWorkflowStep, 'approverType' | 'approverRole'>,
): boolean {
  const type = step.approverType.trim().toUpperCase();
  const role = (step.approverRole ?? '').trim().toUpperCase();
  return (
    type === 'HR' ||
    (type === 'ROLE' && (role === 'HR_MANAGER' || role === 'HR'))
  );
}

export function hasLeaveHrManagePermission(
  permissions?: readonly string[],
): boolean {
  return Boolean(permissions?.includes('hr.leave.manage'));
}

export function isLeaveHrActorRole(roleCode: string): boolean {
  return (LEAVE_HR_ACTOR_ROLE_CODES as readonly string[]).includes(roleCode);
}

export function canAccessLeaveHrQueue(authorization: {
  permissions: string[];
  roles: string[];
}): boolean {
  return (
    hasLeaveHrManagePermission(authorization.permissions) &&
    authorization.roles.some(isLeaveHrActorRole)
  );
}

export function canActOnLeaveApprovalStep(input: {
  actorEmployeeId?: string | null;
  subjectEmployeeId: string;
  currentApproverId?: string | null;
  currentStepKind: LeaveApprovalStepName | null;
  actorPermissions?: readonly string[];
  actorIsScopedLeaveHr?: boolean;
  priorStepApproverIds?: readonly (string | null | undefined)[];
}): boolean {
  if (!input.actorEmployeeId) {
    return false;
  }
  if (input.actorEmployeeId === input.subjectEmployeeId) {
    return false;
  }
  if (
    (input.priorStepApproverIds ?? []).some(
      (approverId) => approverId === input.actorEmployeeId,
    )
  ) {
    return false;
  }
  if (input.currentApproverId === input.actorEmployeeId) {
    return true;
  }
  return (
    input.currentStepKind === 'HR' &&
    hasLeaveHrManagePermission(input.actorPermissions) &&
    input.actorIsScopedLeaveHr === true
  );
}

export function leaveApprovalStepLabel(name: LeaveApprovalStepName): string {
  if (name === 'REPORTING_MANAGER') return 'Reporting manager';
  if (name === 'HR') return 'HR';
  return 'Approver';
}

export function classifyLeaveTransactionStep(params: {
  stepNo: number;
  steps: Array<{ stepNo: number }>;
  workflowSteps: Array<
    Pick<ApprovalWorkflowStep, 'stepNo' | 'approverType' | 'approverRole'>
  >;
}): LeaveApprovalStepName {
  const workflowStep = params.workflowSteps.find(
    (step) => step.stepNo === params.stepNo,
  );
  if (workflowStep) {
    if (isLeaveManagerWorkflowStep(workflowStep)) return 'REPORTING_MANAGER';
    if (isLeaveHrWorkflowStep(workflowStep)) return 'HR';
    return 'OTHER';
  }
  const maxStep = Math.max(...params.steps.map((step) => step.stepNo));
  const minStep = Math.min(...params.steps.map((step) => step.stepNo));
  if (params.stepNo === maxStep) return 'HR';
  if (params.stepNo === minStep) return 'REPORTING_MANAGER';
  return 'OTHER';
}
