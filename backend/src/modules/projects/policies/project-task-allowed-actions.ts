import type { ProjectStatus, ProjectTaskStatus } from '@prisma/client';

import { PROJECTS_PERMISSIONS } from '../constants/projects-permissions';
import type {
  ProjectTaskAction,
  ProjectsActorContext,
} from '../types/project.types';

export function computeProjectTaskAllowedActions(input: {
  projectStatus: ProjectStatus;
  taskStatus: ProjectTaskStatus;
  projectManagerId: string | null;
  activeParticipantEmployeeIds: string[];
  actor: ProjectsActorContext;
}): ProjectTaskAction[] {
  if (
    input.projectStatus === 'CANCELLED' ||
    input.projectStatus === 'COMPLETED' ||
    input.projectStatus === 'ON_HOLD'
  ) {
    return [];
  }

  const canWork = input.actor.permissions.includes(
    PROJECTS_PERMISSIONS.TASKS_WORK,
  );
  const isPm =
    Boolean(input.actor.employeeId) &&
    input.actor.employeeId === input.projectManagerId;
  const isAssignee =
    Boolean(input.actor.employeeId) &&
    input.activeParticipantEmployeeIds.includes(input.actor.employeeId!);

  const actions: ProjectTaskAction[] = [];

  if (isPm) {
    switch (input.taskStatus) {
      case 'OPEN':
        actions.push('ASSIGN', 'CANCEL');
        break;
      case 'ASSIGNED':
        actions.push('REASSIGN', 'UNASSIGN', 'CANCEL');
        break;
      case 'IN_PROGRESS':
        actions.push('REASSIGN', 'CANCEL');
        break;
      case 'WAITING_REVIEW':
        actions.push('RETURN', 'COMPLETE', 'CANCEL');
        break;
      default:
        break;
    }
  }

  if ((canWork || isAssignee) && isAssignee) {
    switch (input.taskStatus) {
      case 'ASSIGNED':
        actions.push('START', 'LOG_TIME');
        break;
      case 'IN_PROGRESS':
        actions.push('SUBMIT_REVIEW', 'LOG_TIME', 'ATTACH_DOCUMENT');
        break;
      case 'WAITING_REVIEW':
        actions.push('ATTACH_DOCUMENT');
        break;
      default:
        break;
    }
  }

  return [...new Set(actions)];
}
