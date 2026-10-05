import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDetail, ProjectTask } from "../types/project.types";
import { ProjectDetailWorkspace } from "./project-detail-workspace";

const { memberCandidates, assigneeCandidates } = vi.hoisted(() => ({
  memberCandidates: vi.fn(),
  assigneeCandidates: vi.fn(),
}));

vi.mock("../services/projects-api.service", () => ({
  ProjectsApiService: { memberCandidates, assigneeCandidates },
}));

const project: ProjectDetail = {
  id: "project-1",
  version: 1,
  projectCode: "PRJ-1",
  projectName: "Search test project",
  description: null,
  projectType: "INTERNAL",
  status: "DRAFT",
  companyId: "company-1",
  branchId: null,
  projectManagerId: null,
  businessPartyId: null,
  currencyCode: null,
  expectedIncome: null,
  expenseBudget: null,
  startDate: null,
  endDate: null,
  archivedAt: null,
  allowedActions: ["MANAGE_TEAM", "MANAGE_TASKS"],
  actionRequirements: { expectedVersion: 1 },
};

const task: ProjectTask = {
  id: "task-1",
  version: 1,
  projectId: project.id,
  stageId: "stage-1",
  taskCode: "TASK-1",
  taskName: "Review work",
  description: null,
  parentTaskId: null,
  priority: "NORMAL",
  plannedHours: null,
  completionPercentage: "0",
  status: "DRAFT",
  startDate: null,
  dueDate: null,
  activeParticipantEmployeeIds: [],
  allowedActions: ["ASSIGN"],
  actionRequirements: { expectedVersion: 1 },
};

vi.mock("../hooks/use-projects", () => ({
  useProject: () => ({ data: project, isLoading: false, error: null }),
  useProjectStages: () => ({ data: [] }),
  useProjectTeam: () => ({ data: [] }),
  useProjectTasks: () => ({ data: [task] }),
  useProjectSummary: () => ({ data: undefined }),
  useProjectTimeSummary: () => ({ data: undefined }),
  useProjectFinanceSummary: () => ({ data: undefined }),
  useProjectCommand: () => ({ isPending: false, mutate: vi.fn() }),
}));

const initialCandidates = Array.from({ length: 50 }, (_, index) => ({
  employeeId: `employee-${index}`,
  displayName: `Person ${index}`,
  employeeCode: `E${index}`,
}));
const targetCandidate = {
  employeeId: "employee-51",
  displayName: "Target Person",
  employeeCode: "E51",
};

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectDetailWorkspace projectId={project.id} />
    </QueryClientProvider>
  );
}

describe("ProjectDetailWorkspace candidate search", () => {
  beforeEach(() => {
    memberCandidates.mockImplementation(async (_projectId, keyword?: string) =>
      keyword === "Target" ? [targetCandidate] : initialCandidates
    );
    assigneeCandidates.mockImplementation(async (_projectId, _taskId, keyword?: string) =>
      keyword === "Target" ? [targetCandidate] : initialCandidates
    );
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("finds an eligible employee beyond the initial 50 for Add member", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Team" }));
    await user.click(screen.getByRole("button", { name: "Add member" }));

    const dialog = screen.getByRole("dialog", { name: "Add team member" });
    expect(memberCandidates).toHaveBeenCalledWith(project.id, undefined);
    expect(within(dialog).queryByRole("option", { name: /Target Person/ })).not.toBeInTheDocument();

    await user.type(
      within(dialog).getByRole("textbox", { name: "Search eligible employees" }),
      "Target"
    );
    await user.click(within(dialog).getByRole("button", { name: "Search members" }));

    expect(memberCandidates).toHaveBeenCalledWith(project.id, "Target");
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Eligible employee" }),
      targetCandidate.employeeId
    );
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("finds a team member beyond the initial 50 for Assign task", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    const dialog = screen.getByRole("dialog", { name: "Assign task" });
    expect(assigneeCandidates).toHaveBeenCalledWith(project.id, task.id, undefined);
    expect(within(dialog).queryByRole("option", { name: /Target Person/ })).not.toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox", { name: "Search team members" }), "Target");
    await user.click(within(dialog).getByRole("button", { name: "Search assignees" }));

    expect(assigneeCandidates).toHaveBeenCalledWith(project.id, task.id, "Target");
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Assignee" }),
      targetCandidate.employeeId
    );
    expect(within(dialog).getByRole("button", { name: "Assign" })).toBeEnabled();
  });

  it("shows a member lookup failure and retries the same search", async () => {
    memberCandidates
      .mockResolvedValueOnce(initialCandidates)
      .mockRejectedValueOnce(new Error("Lookup unavailable"))
      .mockResolvedValueOnce([targetCandidate]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Team" }));
    await user.click(screen.getByRole("button", { name: "Add member" }));

    const dialog = screen.getByRole("dialog", { name: "Add team member" });
    await screen.findByRole("option", { name: "Person 0" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Search eligible employees" }),
      "Target"
    );
    await user.click(within(dialog).getByRole("button", { name: "Search members" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not load eligible employees"
    );
    expect(within(dialog).queryByText(/No matching eligible employees/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Retry search" }));

    expect(memberCandidates).toHaveBeenLastCalledWith(project.id, "Target");
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Eligible employee" }),
      targetCandidate.employeeId
    );
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("shows an assignee lookup failure and retries the same search", async () => {
    assigneeCandidates
      .mockResolvedValueOnce(initialCandidates)
      .mockRejectedValueOnce(new Error("Lookup unavailable"))
      .mockResolvedValueOnce([targetCandidate]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    const dialog = screen.getByRole("dialog", { name: "Assign task" });
    await screen.findByRole("option", { name: "Person 0 (E0)" });
    await user.type(within(dialog).getByRole("textbox", { name: "Search team members" }), "Target");
    await user.click(within(dialog).getByRole("button", { name: "Search assignees" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not load team members"
    );
    expect(within(dialog).queryByText(/No matching active team members/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Retry search" }));

    expect(assigneeCandidates).toHaveBeenLastCalledWith(project.id, task.id, "Target");
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Assignee" }),
      targetCandidate.employeeId
    );
    expect(within(dialog).getByRole("button", { name: "Assign" })).toBeEnabled();
  });

  it("submits member search with Enter and keeps its keyword fixed during lookup", async () => {
    let resolveSearch: (value: typeof initialCandidates) => void = () => {};
    const searchPending = new Promise<typeof initialCandidates>((resolve) => {
      resolveSearch = resolve;
    });
    memberCandidates.mockResolvedValueOnce(initialCandidates).mockReturnValueOnce(searchPending);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Team" }));
    await user.click(screen.getByRole("button", { name: "Add member" }));

    const dialog = screen.getByRole("dialog", { name: "Add team member" });
    await screen.findByRole("option", { name: "Person 0" });
    const keyword = within(dialog).getByRole("textbox", { name: "Search eligible employees" });
    await user.type(keyword, "Target{Enter}");

    await waitFor(() => expect(memberCandidates).toHaveBeenLastCalledWith(project.id, "Target"));
    expect(keyword).toBeDisabled();
    resolveSearch([targetCandidate]);
    expect(
      await within(dialog).findByRole("option", { name: "Target Person" })
    ).toBeInTheDocument();
    expect(keyword).toBeEnabled();
  });

  it("keeps the initial member empty state until a new search is submitted", async () => {
    memberCandidates.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("tab", { name: "Team" }));
    await user.click(screen.getByRole("button", { name: "Add member" }));

    const dialog = screen.getByRole("dialog", { name: "Add team member" });
    expect(await within(dialog).findByText("No eligible employees available.")).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Search eligible employees" }),
      "Target"
    );

    expect(within(dialog).getByText("No eligible employees available.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/No matching eligible employees/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Search members" }));
    expect(await within(dialog).findByText(/No matching eligible employees/)).toBeInTheDocument();
  });
});
