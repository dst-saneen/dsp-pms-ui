import type {
  ProjectStageStatus,
  ProjectStatus,
  ProjectTaskStatus,
} from '@prisma/client';

const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const STAGE_TRANSITIONS: Record<ProjectStageStatus, ProjectStageStatus[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TASK_TRANSITIONS: Record<ProjectTaskStatus, ProjectTaskStatus[]> = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_REVIEW', 'CANCELLED'],
  WAITING_REVIEW: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionProject(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return PROJECT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionStage(
  from: ProjectStageStatus,
  to: ProjectStageStatus,
): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionTask(
  from: ProjectTaskStatus,
  to: ProjectTaskStatus,
): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}
