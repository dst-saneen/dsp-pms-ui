import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMyProjectTask } from "../hooks/use-projects";
import { ProjectsApiService } from "../services/projects-api.service";
import type { ProjectTask, ProjectTaskDetail } from "../types/project.types";
import { MyProjectTaskSheet } from "./my-project-task-sheet";

vi.mock("../hooks/use-projects", () => ({
  useMyProjectTask: vi.fn(),
}));

vi.mock("./project-task-evidence-upload", () => ({
  ProjectTaskEvidenceUpload: () => <div>Evidence uploader</div>,
}));

vi.mock("../services/projects-api.service", () => ({
  ProjectsApiService: {
    taskCommand: vi.fn(),
    downloadTaskDocument: vi.fn(),
  },
}));

const task: ProjectTask = {
  id: "task-1",
  version: 2,
  projectId: "project-1",
  stageId: "stage-1",
  taskCode: "TSK-2026-012",
  taskName: "Configure payroll calculations",
  description: "Configure payroll calculation rules.",
  parentTaskId: null,
  priority: "HIGH",
  plannedHours: "16",
  completionPercentage: "65",
  status: "IN_PROGRESS",
  startDate: "2026-09-20",
  dueDate: "2026-09-28",
  projectCode: "PRJ-2026-004",
  projectName: "Payroll implementation",
  activeParticipantEmployeeIds: ["employee-1"],
  allowedActions: ["ATTACH_DOCUMENT", "LOG_TIME", "SUBMIT_REVIEW"],
  actionRequirements: { expectedVersion: 2 },
};

const detail: ProjectTaskDetail = {
  ...task,
  documents: [
    {
      id: "document-1",
      taskSubmissionId: null,
      documentPurpose: "SUPPORTING_EVIDENCE",
      title: "Payroll calculation screenshot",
      uploadedAt: "2026-09-25T10:00:00.000Z",
    },
  ],
  assignmentHistory: [
    {
      id: "assignment-1",
      employeeId: "employee-1",
      previousEmployeeId: null,
      role: "ASSIGNEE",
      action: "ASSIGNED",
      remarks: null,
      createdAt: "2026-09-20T10:00:00.000Z",
    },
  ],
  submissions: [
    {
      id: "submission-1",
      version: 1,
      versionNo: 1,
      submissionNotes: "Initial calculation setup completed.",
      status: "RETURNED",
      submittedById: "employee-1",
      submittedAt: "2026-09-25T10:00:00.000Z",
      documents: [],
      reviews: [
        {
          id: "review-1",
          version: 1,
          reviewerId: "reviewer-1",
          decision: "RETURNED",
          comments: "Please attach validation evidence.",
          reviewRound: 1,
          reviewedAt: "2026-09-26T10:00:00.000Z",
        },
      ],
    },
  ],
};

function setQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMyProjectTask).mockReturnValue({
    data: detail,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

function renderSheet(props: Partial<React.ComponentProps<typeof MyProjectTaskSheet>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const values = {
    open: true,
    task,
    mode: "details" as const,
    onOpenChange: vi.fn(),
    onModeChange: vi.fn(),
    onChanged: vi.fn(),
    ...props,
  };
  render(<QueryClientProvider client={client}><MyProjectTaskSheet {...values} /></QueryClientProvider>);
  return values;
}

afterEach(cleanup);

describe("MyProjectTaskSheet", () => {
  it("uses the employee detail query and renders safe task, evidence, and review facts", () => {
    setQuery();
    renderSheet();

    expect(vi.mocked(useMyProjectTask)).toHaveBeenCalledWith("task-1", true);
    expect(screen.getByRole("dialog", { name: "Task details" })).toHaveClass("data-[side=right]:sm:max-w-[34rem]");
    expect(screen.getByText("Payroll implementation · PRJ-2026-004")).toBeVisible();
    expect(screen.getByText("Evidence uploader")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download" })).toBeVisible();
    expect(screen.getByText("Submission and review history")).toBeVisible();
    expect(screen.queryByText("employee-1")).not.toBeInTheDocument();
    expect(screen.queryByText("reviewer-1")).not.toBeInTheDocument();
  });

  it("shows a recoverable error state", () => {
    const refetch = vi.fn();
    setQuery({ data: undefined, error: new Error("Unavailable"), refetch });
    renderSheet();

    expect(screen.getByText("Could not load task details.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("moves to the in-drawer review mode without a route change", () => {
    setQuery();
    const props = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(props.onModeChange).toHaveBeenCalledWith("submit-review");
    expect(screen.queryByRole("link", { name: "Log time" })).toHaveAttribute("href", "/my-workspace/timesheets?taskId=task-1");
  });

  it("submits the fresh employee task version from the review drawer", async () => {
    setQuery();
    vi.mocked(ProjectsApiService.taskCommand).mockResolvedValue(task);
    const props = renderSheet({ mode: "submit-review" });

    fireEvent.change(screen.getByRole("textbox", { name: /Note for reviewer/ }), {
      target: { value: "Validated payroll totals." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => {
      expect(ProjectsApiService.taskCommand).toHaveBeenCalledWith(
        "project-1",
        "task-1",
        "submit-review",
        expect.objectContaining({
          expectedVersion: 2,
          reason: "Validated payroll totals.",
        }),
      );
    });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refreshes the list and returns to details after a stale review submission fails", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { ...detail, allowedActions: ["LOG_TIME"] },
    });
    setQuery({ refetch });
    vi.mocked(ProjectsApiService.taskCommand).mockRejectedValue(
      new Error("Task changed"),
    );
    const props = renderSheet({ mode: "submit-review" });

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => {
      expect(props.onChanged).toHaveBeenCalledTimes(1);
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(props.onModeChange).toHaveBeenCalledWith("details");
    });
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
