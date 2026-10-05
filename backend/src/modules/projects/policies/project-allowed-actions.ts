import type { ProjectStatus } from '@prisma/client';

import { PROJECTS_PERMISSIONS } from '../constants/projects-permissions';
import type {
  ProjectAction,
  ProjectsActorContext,
} from '../types/project.types';

export function computeProjectAllowedActions(input: {
  status: ProjectStatus;
  archivedAt: Date | null;
  projectManagerId: string | null;
  actor: ProjectsActorContext;
}): ProjectAction[] {
  if (input.archivedAt) {
    return [];
  }

  const canManage = input.actor.permissions.includes(
    PROJECTS_PERMISSIONS.MANAGE,
  );
  if (!canManage) {
    return [];
  }

  const isPm =
    Boolean(input.actor.employeeId) &&
    input.actor.employeeId === input.projectManagerId;

  const actions: ProjectAction[] = [];

  switch (input.status) {
    case 'DRAFT':
      actions.push('EDIT', 'ACTIVATE', 'CANCEL', 'ARCHIVE');
      // Draft setup may be done by any projects.manage actor before a PM owns work.
      if (canManage) {
        actions.push('MANAGE_STAGES', 'MANAGE_TEAM', 'MANAGE_TASKS');
      }
      break;
    case 'ACTIVE':
      actions.push('EDIT', 'HOLD', 'COMPLETE', 'CANCEL');
      // Nested operational authority is record-level Project Manager only.
      if (isPm) {
        actions.push('MANAGE_STAGES', 'MANAGE_TEAM', 'MANAGE_TASKS');
      }
      break;
    case 'ON_HOLD':
      actions.push('RESUME', 'CANCEL');
      break;
    case 'COMPLETED':
    case 'CANCELLED':
      actions.push('ARCHIVE');
      break;
    default:
      break;
  }

  return [...new Set(actions)];
}
