import { describe, expect, it } from "vitest";

import type { ProjectTask } from "../types/project.types";
import {
  deriveMyProjectsView,
  isProjectTaskOverdue,
  normalizeTaskProgress,
  paginateMyProjectTasks,
  projectTaskStatusLabel,
  type MyProjectsFilters,
} from "./my-projects-view-model";

const businessDate = "2026-09-24";

function task(
  overrides: Partial<ProjectTask> & Pick<ProjectTask, "id">,
): ProjectTask {
  return {
    version: 1,
    projectId: "project-1",
    stageId: "stage-1",
    taskCode: `TSK-${overrides.id}`,
    taskName: "Configure payroll calculations",
    description: null,
    parentTaskId: null,
    priority: "MEDIUM",
    plannedHours: "8",
    completionPercentage: "0",
    status: "ASSIGNED",
    startDate: null,
    dueDate: null,
    projectCode: "PRJ-001",
    projectName: "Payroll implementation",
    activeParticipantEmployeeIds: ["employee-1"],
    allowedActions: ["START", "LOG_TIME"],
    actionRequirements: { expectedVersion: 1 },
    ...overrides,
  };
}

const defaultFilters: MyProjectsFilters = {
  keyword: "",
  projectId: "ALL",
  status: "ALL",
  priority: "ALL",
  due: "ALL",
  sort: "DUE_ASC",
};

const tasks = [
  task({
    id: "assigned-past-due",
    projectId: "project-payroll",
    projectCode: "PRJ-PAY",
    projectName: "Payroll implementation",
    taskCode: "TSK-2026-012",
    dueDate: "2026-09-23",
    priority: "HIGH",
  }),
  task({
    id: "in-progress-today",
    projectId: "project-payroll",
    projectCode: "PRJ-PAY",
    projectName: "Payroll implementation",
    taskName: "Validate payroll totals",
    taskCode: "TSK-2026-013",
    status: "IN_PROGRESS",
    dueDate: "2026-09-24",
    priority: "URGENT",
  }),
  task({
    id: "awaiting-review-next-week",
    projectId: "project-portal",
    projectCode: "PRJ-PORTAL",
    projectName: "Customer portal",
    taskName: "Upload API integration evidence",
    taskCode: "TSK-2026-014",
    status: "WAITING_REVIEW",
    dueDate: "2026-10-01",
    priority: "LOW",
  }),
  task({
    id: "open-no-date",
    projectId: "project-portal",
    projectCode: "PRJ-PORTAL",
    projectName: "Customer portal",
    taskName: "Prepare acceptance checklist",
    taskCode: "TSK-2026-015",
    status: "OPEN",
    dueDate: null,
    priority: "MEDIUM",
  }),
];

describe("My Projects view model", () => {
  it("keeps the summary based on all assigned tasks and maps only active UI statuses", () => {
    const result = deriveMyProjectsView(
      tasks,
      { ...defaultFilters, status: "IN_PROGRESS" },
      businessDate,
    );

    expect(result.summary).toEqual({
      assigned: 4,
      projectCount: 2,
      inProgress: 1,
      awaitingReview: 1,
      overdue: 1,
    });
    expect(result.filteredTasks.map((item) => item.id)).toEqual([
      "in-progress-today",
    ]);
    expect(projectTaskStatusLabel("OPEN")).toBe("To do");
    expect(projectTaskStatusLabel("ASSIGNED")).toBe("To do");
    expect(projectTaskStatusLabel("IN_PROGRESS")).toBe("In progress");
    expect(projectTaskStatusLabel("WAITING_REVIEW")).toBe("Awaiting review");
    expect(projectTaskStatusLabel("COMPLETED")).toBe("COMPLETED");
  });

  it("combines real task filters, searches codes and names, and derives actual filter options", () => {
    const result = deriveMyProjectsView(
      tasks,
      {
        ...defaultFilters,
        keyword: "TSK-2026-012",
        projectId: "project-payroll",
        priority: "HIGH",
        due: "OVERDUE",
      },
      businessDate,
    );

    expect(result.filteredTasks.map((item) => item.id)).toEqual([
      "assigned-past-due",
    ]);
    expect(result.projectOptions).toEqual([
      { id: "project-portal", label: "Customer portal" },
      { id: "project-payroll", label: "Payroll implementation" },
    ]);
    expect(result.priorityOptions).toEqual(["URGENT", "HIGH", "MEDIUM", "LOW"]);
  });

  it("recognizes due-date buckets and keeps missing or invalid dates out of date buckets", () => {
    expect(
      deriveMyProjectsView(tasks, { ...defaultFilters, due: "TODAY" }, businessDate)
        .filteredTasks.map((item) => item.id),
    ).toEqual(["in-progress-today"]);
    expect(
      deriveMyProjectsView(tasks, { ...defaultFilters, due: "NEXT_7_DAYS" }, businessDate)
        .filteredTasks.map((item) => item.id),
    ).toEqual(["in-progress-today", "awaiting-review-next-week"]);
    expect(
      deriveMyProjectsView(tasks, { ...defaultFilters, due: "NO_DUE_DATE" }, businessDate)
        .filteredTasks.map((item) => item.id),
    ).toEqual(["open-no-date"]);

    const invalidDateTask = task({
      id: "invalid-date",
      dueDate: "not-a-date",
      taskName: "Invalid date task",
    });
    expect(isProjectTaskOverdue(invalidDateTask, businessDate)).toBe(false);
    expect(
      deriveMyProjectsView(
        [invalidDateTask],
        { ...defaultFilters, due: "TODAY" },
        businessDate,
      ).filteredTasks,
    ).toEqual([]);
    expect(
      deriveMyProjectsView(
        [invalidDateTask],
        { ...defaultFilters, due: "NO_DUE_DATE" },
        businessDate,
      ).filteredTasks,
    ).toEqual([]);
  });

  it("sorts due dates with nulls last, applies business priority order, and clamps pages", () => {
    expect(
      deriveMyProjectsView(tasks, defaultFilters, businessDate).filteredTasks.map(
        (item) => item.id,
      ),
    ).toEqual([
      "assigned-past-due",
      "in-progress-today",
      "awaiting-review-next-week",
      "open-no-date",
    ]);
    expect(
      deriveMyProjectsView(
        tasks,
        { ...defaultFilters, sort: "DUE_DESC" },
        businessDate,
      ).filteredTasks.map((item) => item.id),
    ).toEqual([
      "awaiting-review-next-week",
      "in-progress-today",
      "assigned-past-due",
      "open-no-date",
    ]);
    expect(
      deriveMyProjectsView(
        tasks,
        { ...defaultFilters, sort: "PRIORITY_DESC" },
        businessDate,
      ).filteredTasks.map((item) => item.id),
    ).toEqual([
      "in-progress-today",
      "assigned-past-due",
      "open-no-date",
      "awaiting-review-next-week",
    ]);
    expect(paginateMyProjectTasks(tasks, 9, 2)).toEqual({
      items: [tasks[2], tasks[3]],
      page: 2,
      pageCount: 2,
    });
  });

  it("normalizes malformed progress without leaking NaN into the interface", () => {
    expect(normalizeTaskProgress("65.5")).toBe(65.5);
    expect(normalizeTaskProgress("-5")).toBe(0);
    expect(normalizeTaskProgress("101")).toBe(100);
    expect(normalizeTaskProgress(null)).toBe(0);
    expect(normalizeTaskProgress("not-a-number")).toBe(0);
  });
});
