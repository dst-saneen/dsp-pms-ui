export const projectsKeys = {
  all: ["projects"] as const,
  capabilities: () => [...projectsKeys.all, "workspace-capabilities"] as const,
  managerCandidates: (keyword?: string) =>
    [...projectsKeys.all, "manager-candidates", keyword ?? ""] as const,
  list: (params?: Record<string, unknown>) =>
    [...projectsKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...projectsKeys.all, "detail", id] as const,
  stages: (id: string) => [...projectsKeys.all, "stages", id] as const,
  team: (id: string) => [...projectsKeys.all, "team", id] as const,
  tasks: (id: string) => [...projectsKeys.all, "tasks", id] as const,
  summary: (id: string) => [...projectsKeys.all, "summary", id] as const,
  timeSummary: (id: string) =>
    [...projectsKeys.all, "time-summary", id] as const,
  financeSummary: (id: string) =>
    [...projectsKeys.all, "finance-summary", id] as const,
  myTasks: () => [...projectsKeys.all, "my-tasks"] as const,
  myTask: (taskId: string) => [...projectsKeys.all, "my-task", taskId] as const,
  myTimesheets: (params?: Record<string, unknown>) =>
    [...projectsKeys.all, "my-timesheets", params ?? {}] as const,
  myTimesheet: (id: string) =>
    [...projectsKeys.all, "my-timesheet", id] as const,
  teamTimesheets: (params?: Record<string, unknown>) =>
    [...projectsKeys.all, "team-timesheets", params ?? {}] as const,
};
