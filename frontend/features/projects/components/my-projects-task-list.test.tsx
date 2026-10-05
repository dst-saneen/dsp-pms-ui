import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectTask } from "../types/project.types";
import { MyProjectsTaskList } from "./my-projects-task-list";

function task(overrides: Partial<ProjectTask> & Pick<ProjectTask, "id">): ProjectTask {
  return {
    version: 1,
    projectId: "project-1",
    stageId: "stage-1",
    taskCode: `TSK-${overrides.id}`,
    taskName: "Configure payroll calculations",
    description: null,
    parentTaskId: null,
    priority: "HIGH",
    plannedHours: "16",
    completionPercentage: "65",
    status: "IN_PROGRESS",
    startDate: null,
    dueDate: "2026-09-23",
    projectCode: "PRJ-2026-004",
    projectName: "Payroll implementation",
    activeParticipantEmployeeIds: ["employee-1"],
    allowedActions: ["START", "SUBMIT_REVIEW", "LOG_TIME"],
    actionRequirements: { expectedVersion: 1 },
    ...overrides,
  };
}

const firstTask = task({ id: "task-1" });
const secondTask = task({
  id: "task-2",
  taskName: "Prepare acceptance checklist",
  priority: "MEDIUM",
  status: "ASSIGNED",
  dueDate: null,
  completionPercentage: null,
  allowedActions: ["LOG_TIME"],
});

function renderList(overrides: Partial<React.ComponentProps<typeof MyProjectsTaskList>> = {}) {
  const props: React.ComponentProps<typeof MyProjectsTaskList> = {
    tasks: [firstTask, secondTask],
    filteredTotal: 12,
    page: 1,
    pageCount: 2,
    pageSize: 10,
    businessDate: "2026-09-24",
    startingTaskIds: [],
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onOpenTask: vi.fn(),
    onStartTask: vi.fn(),
    ...overrides,
  };
  render(<MyProjectsTaskList {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
});

describe("MyProjectsTaskList", () => {
  it("renders the approved table facts with friendly task status, progress, and overdue treatment", () => {
    renderList();

    ["Task", "Project", "Priority", "Status", "Progress", "Due date", "Actions"].forEach((header) => {
      expect(screen.getAllByRole("columnheader", { name: header }).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Configure payroll calculations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TSK-task-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payroll implementation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("To do").length).toBeGreaterThan(0);
    expect(screen.getAllByText("65%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 day overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows only API-allowed actions and sends each action to the correct destination", () => {
    const props = renderList();

    expect(screen.getAllByRole("button", { name: "Start" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Submit for review" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Log time" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Log time" })[0]).toHaveAttribute(
      "href",
      "/my-workspace/timesheets?taskId=task-1",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Submit for review" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);

    expect(props.onStartTask).toHaveBeenCalledWith(firstTask);
    expect(props.onOpenTask).toHaveBeenCalledWith(firstTask, "submit-review");
    expect(props.onOpenTask).toHaveBeenCalledWith(firstTask, "details");
  });

  it("uses separate responsive presentations and passes pagination controls through", () => {
    const props = renderList();

    expect(screen.getByTestId("my-projects-desktop-results")).toHaveClass("hidden", "md:block");
    expect(screen.getByTestId("my-projects-mobile-results")).toHaveClass("md:hidden");
    expect(screen.getByText("Showing 1–10 of 12 tasks")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "25" },
    });

    expect(props.onPageChange).toHaveBeenCalledWith(2);
    expect(props.onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it("keeps every pending Start task disabled until its own mutation settles", () => {
    renderList({ startingTaskIds: ["task-1"] });

    expect(screen.getAllByRole("button", { name: "Start" })).toHaveLength(2);
    screen.getAllByRole("button", { name: "Start" }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
