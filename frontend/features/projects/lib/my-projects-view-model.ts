import type { ProjectTask } from "../types/project.types";

export type MyProjectsStatusFilter =
  | "ALL"
  | "TO_DO"
  | "IN_PROGRESS"
  | "WAITING_REVIEW";

export type MyProjectsDueFilter =
  | "ALL"
  | "OVERDUE"
  | "TODAY"
  | "NEXT_7_DAYS"
  | "NO_DUE_DATE";

export type MyProjectsSort =
  | "DUE_ASC"
  | "DUE_DESC"
  | "PRIORITY_DESC"
  | "PROJECT_ASC"
  | "TASK_ASC";

export interface MyProjectsFilters {
  keyword: string;
  projectId: string | "ALL";
  status: MyProjectsStatusFilter;
  priority: string | "ALL";
  due: MyProjectsDueFilter;
  sort: MyProjectsSort;
}

export interface MyProjectsSummary {
  assigned: number;
  projectCount: number;
  inProgress: number;
  awaitingReview: number;
  overdue: number;
}

export const DEFAULT_MY_PROJECTS_FILTERS: MyProjectsFilters = {
  keyword: "",
  projectId: "ALL",
  status: "ALL",
  priority: "ALL",
  due: "ALL",
  sort: "DUE_ASC",
};

const priorityOrder: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalized(value: string | null | undefined): string {
  return text(value).toLocaleLowerCase();
}

function dateKey(value: string | null | undefined): string | null {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function datePlusDays(value: string, days: number): string | null {
  const key = dateKey(value);
  if (!key) {
    return null;
  }

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function projectLabel(task: ProjectTask): string {
  return text(task.projectName) || text(task.projectCode) || "Project unavailable";
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function priorityRank(value: string | null | undefined): number {
  return priorityOrder[text(value).toUpperCase()] ?? 4;
}

function matchesStatus(task: ProjectTask, filter: MyProjectsStatusFilter): boolean {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "TO_DO") {
    return task.status === "OPEN" || task.status === "ASSIGNED";
  }

  return task.status === filter;
}

function matchesDueDate(
  task: ProjectTask,
  filter: MyProjectsDueFilter,
  businessDate: string,
): boolean {
  if (filter === "ALL") {
    return true;
  }

  const dueDate = dateKey(task.dueDate);
  const today = dateKey(businessDate);

  if (filter === "NO_DUE_DATE") {
    return !text(task.dueDate);
  }

  if (!dueDate || !today) {
    return false;
  }

  if (filter === "OVERDUE") {
    return dueDate < today;
  }

  if (filter === "TODAY") {
    return dueDate === today;
  }

  const lastDay = datePlusDays(today, 7);
  return Boolean(lastDay && dueDate >= today && dueDate <= lastDay);
}

function compareDueDates(left: ProjectTask, right: ProjectTask, descending = false): number {
  const leftDate = dateKey(left.dueDate);
  const rightDate = dateKey(right.dueDate);

  if (!leftDate && !rightDate) {
    return compareText(left.taskName, right.taskName);
  }
  if (!leftDate) {
    return 1;
  }
  if (!rightDate) {
    return -1;
  }

  return descending
    ? rightDate.localeCompare(leftDate)
    : leftDate.localeCompare(rightDate);
}

function sortTasks(tasks: readonly ProjectTask[], sort: MyProjectsSort): ProjectTask[] {
  return [...tasks].sort((left, right) => {
    if (sort === "DUE_ASC") {
      return compareDueDates(left, right);
    }
    if (sort === "DUE_DESC") {
      return compareDueDates(left, right, true);
    }
    if (sort === "PRIORITY_DESC") {
      const rankDifference = priorityRank(left.priority) - priorityRank(right.priority);
      return rankDifference || compareText(left.taskName, right.taskName);
    }
    if (sort === "PROJECT_ASC") {
      return (
        compareText(projectLabel(left), projectLabel(right)) ||
        compareText(left.taskName, right.taskName)
      );
    }

    return compareText(left.taskName, right.taskName);
  });
}

export function projectTaskStatusLabel(status: string): string {
  if (status === "OPEN" || status === "ASSIGNED") {
    return "To do";
  }
  if (status === "IN_PROGRESS") {
    return "In progress";
  }
  if (status === "WAITING_REVIEW") {
    return "Awaiting review";
  }
  return status;
}

export function normalizeTaskProgress(
  value: string | null | undefined,
): number {
  const progress = Number(value);
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progress));
}

export function isProjectTaskOverdue(
  task: ProjectTask,
  businessDate: string,
): boolean {
  const dueDate = dateKey(task.dueDate);
  const today = dateKey(businessDate);
  return Boolean(dueDate && today && dueDate < today);
}

export function deriveMyProjectsView(
  tasks: readonly ProjectTask[],
  filters: MyProjectsFilters,
  businessDate: string,
): {
  summary: MyProjectsSummary;
  filteredTasks: ProjectTask[];
  projectOptions: Array<{ id: string; label: string }>;
  priorityOptions: string[];
} {
  const projectOptions = Array.from(
    new Map(
      tasks.map((task) => [
        task.projectId,
        { id: task.projectId, label: projectLabel(task) },
      ]),
    ).values(),
  ).sort((left, right) => compareText(left.label, right.label));

  const priorityOptions = Array.from(
    new Set(tasks.map((task) => text(task.priority).toUpperCase()).filter(Boolean)),
  ).sort((left, right) => priorityRank(left) - priorityRank(right) || compareText(left, right));

  const summary: MyProjectsSummary = {
    assigned: tasks.length,
    projectCount: projectOptions.length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    awaitingReview: tasks.filter((task) => task.status === "WAITING_REVIEW").length,
    overdue: tasks.filter((task) => isProjectTaskOverdue(task, businessDate)).length,
  };

  const keyword = normalized(filters.keyword);
  const filteredTasks = sortTasks(
    tasks.filter((task) => {
      const searchable = [
        task.taskName,
        task.taskCode,
        task.projectName,
        task.projectCode,
      ]
        .map(normalized)
        .join(" ");

      return (
        (!keyword || searchable.includes(keyword)) &&
        (filters.projectId === "ALL" || task.projectId === filters.projectId) &&
        matchesStatus(task, filters.status) &&
        (filters.priority === "ALL" ||
          text(task.priority).toUpperCase() === filters.priority.toUpperCase()) &&
        matchesDueDate(task, filters.due, businessDate)
      );
    }),
    filters.sort,
  );

  return { summary, filteredTasks, projectOptions, priorityOptions };
}

export function paginateMyProjectTasks(
  tasks: readonly ProjectTask[],
  page: number,
  pageSize: number,
): { items: ProjectTask[]; page: number; pageCount: number } {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 10);
  const pageCount = Math.max(1, Math.ceil(tasks.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (safePage - 1) * safePageSize;

  return {
    items: tasks.slice(start, start + safePageSize),
    page: safePage,
    pageCount,
  };
}
