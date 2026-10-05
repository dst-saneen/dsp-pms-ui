import type { AuthenticatedUser } from '../auth';
import {
  canActOnLeaveApprovalStep,
  classifyLeaveTransactionStep,
  leaveApprovalStepLabel,
  type LeaveApprovalStepName,
} from '../workforce-approval/leave-approval.util';
import {
  LeaveRequestStatus,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
} from '../employee-leave/constants';

export type LeaveApprovalStage =
  | 'DRAFT'
  | 'MANAGER_REVIEW'
  | 'HR_REVIEW'
  | 'APPROVER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type LeaveApprovalProgress = {
  stage: LeaveApprovalStage;
  currentStepName: string | null;
  previousStepName: string | null;
  canAct: boolean;
  isFinalStep: boolean;
  steps: Array<{
    name: string;
    status: string;
    decidedAt: string | null;
  }>;
  balancePreview: {
    year: number | null;
    entitlement: number | null;
    used: number;
    pending: number;
    available: number;
    afterApprove: { used: number; pending: number; available: number };
    afterReject: { used: number; pending: number; available: number };
  } | null;
};

type ProgressRequest = {
  status: string;
  requestedDays: unknown;
  employeeId: string;
  leaveBalance?: {
    year?: number;
    entitlement?: unknown;
    used?: unknown;
    pending?: unknown;
    balance?: unknown;
  } | null;
  approvalTransaction?: {
    currentStep: number;
    status: string;
    workflow?: {
      steps: Array<{
        stepNo: number;
        approverType: string;
        approverRole: string | null;
      }>;
    } | null;
    approvalSteps: Array<{
      stepNo: number;
      status: string;
      approverId: string | null;
      actionDate: Date | null;
    }>;
  } | null;
};

export function leaveCalendarApprovalStage(request: {
  status: string;
  approvalTransaction?: ProgressRequest['approvalTransaction'];
}): LeaveApprovalStage {
  return buildLeaveApprovalProgress({
    status: request.status,
    requestedDays: 0,
    employeeId: '',
    approvalTransaction: request.approvalTransaction ?? null,
  }).stage;
}

export function buildLeaveApprovalProgress(
  request: ProgressRequest,
  actor?: AuthenticatedUser,
  options?: { actorIsScopedLeaveHr?: boolean },
): LeaveApprovalProgress {
  const requestedDays = Number(request.requestedDays ?? 0);
  const steps = [...(request.approvalTransaction?.approvalSteps ?? [])].sort(
    (left, right) => left.stepNo - right.stepNo,
  );
  const workflowSteps = request.approvalTransaction?.workflow?.steps ?? [];
  const currentStepNo = request.approvalTransaction?.currentStep;
  const current = steps.find((step) => step.stepNo === currentStepNo) ?? null;
  const previous = current
    ? ([...steps]
        .reverse()
        .find(
          (step) =>
            step.stepNo < current.stepNo &&
            (step.status === 'APPROVED' || step.status === 'SKIPPED'),
        ) ?? null)
    : null;

  const namedSteps = steps.map((step) => {
    const name = classifyLeaveTransactionStep({
      stepNo: step.stepNo,
      steps,
      workflowSteps,
    });
    return {
      name: leaveApprovalStepLabel(name),
      kind: name,
      status: step.status,
      decidedAt: step.actionDate ? step.actionDate.toISOString() : null,
      approverId: step.approverId,
    };
  });

  const currentKind: LeaveApprovalStepName | null = current
    ? classifyLeaveTransactionStep({
        stepNo: current.stepNo,
        steps,
        workflowSteps,
      })
    : null;
  const lastStep = steps[steps.length - 1] ?? null;
  const isFinalStep = Boolean(
    current && lastStep && current.stepNo === lastStep.stepNo,
  );

  return {
    stage: resolveStage(request.status, currentKind, isFinalStep),
    currentStepName: current
      ? leaveApprovalStepLabel(currentKind ?? 'OTHER')
      : null,
    previousStepName: previous
      ? leaveApprovalStepLabel(
          classifyLeaveTransactionStep({
            stepNo: previous.stepNo,
            steps,
            workflowSteps,
          }),
        )
      : null,
    canAct: Boolean(
      current?.status === 'PENDING' &&
      (request.status === LeaveRequestStatus.SUBMITTED ||
        request.status === LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS) &&
      canActOnLeaveApprovalStep({
        actorEmployeeId: actor?.employeeId,
        subjectEmployeeId: request.employeeId,
        currentApproverId: current.approverId,
        currentStepKind: currentKind,
        actorPermissions: actor?.authorization.permissions,
        actorIsScopedLeaveHr: options?.actorIsScopedLeaveHr,
        priorStepApproverIds: steps
          .filter(
            (step) =>
              step.stepNo < current.stepNo &&
              (step.status === 'APPROVED' || step.status === 'SKIPPED'),
          )
          .map((step) => step.approverId),
      }),
    ),
    isFinalStep,
    steps: namedSteps.map(({ name, status, decidedAt }) => ({
      name,
      status,
      decidedAt,
    })),
    balancePreview: buildBalancePreview(request.leaveBalance, requestedDays),
  };
}

function resolveStage(
  status: string,
  currentKind: LeaveApprovalStepName | null,
  isFinalStep: boolean,
): LeaveApprovalStage {
  if (status === LeaveRequestStatus.DRAFT) return 'DRAFT';
  if (status === LeaveRequestStatus.APPROVED) return 'APPROVED';
  if (status === LeaveRequestStatus.REJECTED) return 'REJECTED';
  if (status === LeaveRequestStatus.CANCELLED) return 'CANCELLED';
  if (currentKind === 'HR' || isFinalStep) return 'HR_REVIEW';
  if (currentKind === 'REPORTING_MANAGER') return 'MANAGER_REVIEW';
  if (currentKind) return 'APPROVER_REVIEW';
  return 'HR_REVIEW';
}

function buildBalancePreview(
  balance: ProgressRequest['leaveBalance'],
  requestedDays: number,
): LeaveApprovalProgress['balancePreview'] {
  if (!balance) return null;
  const used = Number(balance.used ?? 0);
  const pending = Number(balance.pending ?? 0);
  const available = Number(balance.balance ?? 0);
  return {
    year: balance.year ?? null,
    entitlement:
      balance.entitlement == null ? null : Number(balance.entitlement),
    used,
    pending,
    available,
    afterApprove: {
      used: used + requestedDays,
      pending: Math.max(0, pending - requestedDays),
      available,
    },
    afterReject: {
      used,
      pending: Math.max(0, pending - requestedDays),
      available: available + requestedDays,
    },
  };
}
