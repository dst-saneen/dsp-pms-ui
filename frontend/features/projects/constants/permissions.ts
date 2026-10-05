export const PROJECTS_PERMISSIONS = {
  READ: "projects.projects.read",
  MANAGE: "projects.projects.manage",
  TASKS_WORK: "projects.tasks.work",
  TIMESHEETS_SUBMIT: "projects.timesheets.submit",
  TIMESHEETS_APPROVE: "projects.timesheets.approve",
} as const;

export const PROJECTS_ROUTES = {
  list: "/projects/projects",
  detail: (id: string) => `/projects/projects/${id}`,
  myProjects: "/my-workspace/projects",
  myTimesheets: "/my-workspace/timesheets",
  teamTimesheets: "/team/timesheets",
} as const;
