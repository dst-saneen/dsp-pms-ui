/**
 * Projects permission codes
 * (project-db-api-ui-implementation-plan §4.2).
 */
export const PROJECTS_PERMISSIONS = {
  READ: 'projects.projects.read',
  MANAGE: 'projects.projects.manage',
  TASKS_WORK: 'projects.tasks.work',
  TIMESHEETS_SUBMIT: 'projects.timesheets.submit',
  TIMESHEETS_APPROVE: 'projects.timesheets.approve',
} as const;

export type ProjectsPermissionCode =
  (typeof PROJECTS_PERMISSIONS)[keyof typeof PROJECTS_PERMISSIONS];

export const PROJECTS_PERMISSION_CODE_VALUES =
  Object.values(PROJECTS_PERMISSIONS);
