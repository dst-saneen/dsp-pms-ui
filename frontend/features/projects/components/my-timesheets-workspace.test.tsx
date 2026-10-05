import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Timesheet } from "../types/project.types";
import { MyTimesheetsWorkspace } from "./my-timesheets-workspace";

const { updateLine, removeLine } = vi.hoisted(() => ({
  updateLine: vi.fn(),
  removeLine: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("../services/timesheets-api.service", () => ({
  TimesheetsApiService: {
    create: vi.fn(),
    addLine: vi.fn(),
    updateLine,
    removeLine,
    submit: vi.fn(),
  },
}));

const sheet: Timesheet = {
  id: "sheet-1",
  version: 3,
  companyId: "company-1",
  branchId: "branch-1",
  employeeId: "employee-1",
  periodStart: "2026-09-21",
  periodEnd: "2026-09-27",
  totalHours: "8",
  status: "DRAFT",
  remarks: null,
  reportingManagerEmployeeId: "manager-1",
  reportingManagerUserId: "user-1",
  lines: [
    {
      id: "line-1",
      version: 2,
      workDate: "2026-09-22",
      hours: "8",
      taskId: "task-1",
      workCategoryId: null,
      sourceType: null,
      remarks: "Implementation",
    },
  ],
  allowedActions: ["EDIT", "SUBMIT"],
  actionRequirements: { expectedVersion: 3 },
};

vi.mock("../hooks/use-projects", () => ({
  useMyTimesheets: () => ({
    data: { items: [sheet], total: 1, page: 1, limit: 20 },
    isLoading: false,
    error: null,
  }),
  useMyProjectTasks: () => ({
    data: {
      items: [
        {
          id: "task-1",
          taskName: "Build workflow",
          projectName: "HRMS",
        },
      ],
    },
  }),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MyTimesheetsWorkspace />
    </QueryClientProvider>,
  );
}

describe("MyTimesheetsWorkspace line management", () => {
  beforeEach(() => {
    updateLine.mockReset().mockResolvedValue(sheet);
    removeLine.mockReset().mockResolvedValue(sheet);
  });

  afterEach(cleanup);

  it("shows saved lines and updates a draft line with both versions", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "View lines" }));
    const linesDialog = screen.getByRole("dialog", { name: "Timesheet lines" });
    expect(within(linesDialog).getByText(/2026-09-22 · 8 hours/)).toBeInTheDocument();
    expect(within(linesDialog).getByText(/HRMS — Build workflow/)).toBeInTheDocument();

    await user.click(within(linesDialog).getByRole("button", { name: "Edit" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit timesheet line" });
    const hours = within(editDialog).getByRole("textbox", { name: "Hours" });
    await user.clear(hours);
    await user.type(hours, "6.5");
    await user.click(within(editDialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateLine).toHaveBeenCalledWith(
        sheet.id,
        sheet.lines[0].id,
        expect.objectContaining({
          expectedVersion: 3,
          lineExpectedVersion: 2,
          workDate: "2026-09-22",
          hours: "6.5",
          taskId: "task-1",
          workCategoryId: null,
        }),
      ),
    );
  });

  it("confirms before removing a draft line", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "View lines" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = screen.getByRole("dialog", { name: "Remove timesheet line" });
    await user.click(within(confirm).getByRole("button", { name: "Remove line" }));

    await waitFor(() =>
      expect(removeLine).toHaveBeenCalledWith(
        sheet.id,
        sheet.lines[0].id,
        expect.objectContaining({ expectedVersion: 3 }),
      ),
    );
  });
});
