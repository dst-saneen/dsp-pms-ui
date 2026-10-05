import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMyWorkspace } from "@/features/my-workspace/hooks/use-my-workspace";

import { useMyProjectTask, useMyProjectTasks } from "../hooks/use-projects";
import { ProjectsApiService } from "../services/projects-api.service";
import type { ProjectTask } from "../types/project.types";
import { MyProjectsWorkspace } from "./my-projects-workspace";

vi.mock("../hooks/use-projects", () => ({
  useMyProjectTasks: vi.fn(),
  useMyProjectTask: vi.fn(),
}));

vi.mock("@/features/my-workspace/hooks/use-my-workspace", () => ({
  useMyWorkspace: vi.fn(),
}));

vi.mock("../services/projects-api.service", () => ({
  ProjectsApiService: {
    taskCommand: vi.fn(),
    downloadTaskDocument: vi.fn(),
  },
}));

const tasks: ProjectTask[] = [
  {
    id: "task-1",
    version: 1,
    projectId: "project-1",
    stageId: "stage-1",
    taskCode: "TSK-2026-012",
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
  },
];

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyProjectsWorkspace />
    </QueryClientProvider>,
  );
}

function setQueryState(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMyProjectTasks).mockReturnValue({
    data: { items: tasks, total: tasks.length, page: 1, limit: 100 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
  vi.mocked(useMyWorkspace).mockReturnValue({
    data: { businessDate: "2026-09-24" },
  } as never);
  vi.mocked(useMyProjectTask).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  } as never);
}

afterEach(() => {
  cleanup();
});

describe("MyProjectsWorkspace", () => {
  it("renders the approved employee header and connected real-work summary", () => {
    setQueryState();

    renderWorkspace();

    expect(screen.getByRole("heading", { name: "My projects" })).toBeVisible();
    expect(
      screen.getByText(
        "Track your assigned tasks, complete work, and submit it for review.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My timesheets" })).toBeVisible();
    expect(screen.getByText("Assigned tasks")).toBeVisible();
    expect(screen.getAllByText("In progress").at(0)).toBeVisible();
    expect(screen.getAllByText("Awaiting review").at(0)).toBeVisible();
    expect(screen.getAllByText("Overdue").at(0)).toBeVisible();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Path: Start/i)).not.toBeInTheDocument();
  });

  it("offers accessible controlled filters and clears them back to the default result", () => {
    setQueryState();

    renderWorkspace();

    const search = screen.getAllByRole("searchbox", { name: "Search tasks" })[0];
    fireEvent.change(search, { target: { value: "not found" } });
    expect(screen.getByText("No tasks match the current filters.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).at(0)).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(search).toHaveValue("");
    expect(screen.queryByText("No tasks match the current filters.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeVisible();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows an accessible initial loading surface instead of false zero summaries", () => {
    setQueryState({ data: undefined, isLoading: true });

    renderWorkspace();

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows a concise successful empty state when no assigned tasks exist", () => {
    setQueryState({ data: { items: [], total: 0, page: 1, limit: 100 } });

    renderWorkspace();

    expect(screen.getByText("No assigned project tasks are available.")).toBeVisible();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);
  });

  it("starts only the selected task with its current API version", async () => {
    setQueryState();
    vi.mocked(ProjectsApiService.taskCommand).mockResolvedValue(tasks[0]);

    renderWorkspace();
    fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);

    await waitFor(() => {
      expect(ProjectsApiService.taskCommand).toHaveBeenCalledWith(
        "project-1",
        "task-1",
        "start",
        expect.objectContaining({ expectedVersion: 1 }),
      );
    });
  });
});
