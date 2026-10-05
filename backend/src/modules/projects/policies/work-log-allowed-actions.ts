import type { WorkLogStatus } from '@prisma/client';

import { PROJECTS_PERMISSIONS } from '../constants/projects-permissions';
import type {
  ProjectsActorContext,
  WorkLogAction,
} from '../types/project.types';

export function computeWorkLogAllowedActions(input: {
  status: WorkLogStatus;
  employeeId: string;
  reportingManagerUserId: string | null;
  submittedByUserId: string | null;
  actor: ProjectsActorContext;
}): WorkLogAction[] {
  const isOwner =
    Boolean(input.actor.employeeId) &&
    input.actor.employeeId === input.employeeId;
  const canSubmit = input.actor.permissions.includes(
    PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT,
  );
  const canApprove = input.actor.permissions.includes(
    PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE,
  );
  const isSnapshottedManager =
    Boolean(input.reportingManagerUserId) &&
    input.actor.userId === input.reportingManagerUserId;
  const isSelfApproval =
    Boolean(input.submittedByUserId) &&
    input.submittedByUserId === input.actor.userId;

  const actions: WorkLogAction[] = [];

  if (isOwner && canSubmit) {
    switch (input.status) {
      case 'DRAFT':
        actions.push('EDIT', 'SUBMIT', 'CANCEL');
        break;
      case 'RETURNED':
        actions.push('EDIT', 'SUBMIT', 'CANCEL');
        break;
      default:
        break;
    }
  }

  if (canApprove && isSnapshottedManager && !isSelfApproval) {
    if (input.status === 'SUBMITTED') {
      actions.push('APPROVE', 'RETURN');
    }
  }

  return [...new Set(actions)];
}
