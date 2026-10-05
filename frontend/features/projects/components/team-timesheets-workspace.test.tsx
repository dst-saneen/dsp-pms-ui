import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Timesheet } from "../types/project.types";
import { TeamTimesheetsWorkspace } from "./team-timesheets-workspace";

const sheet: Timesheet = {
  id: "sheet-1",
  version: 3,
  companyId: "company-1",
  branchId: "branch-1",
  employeeId: "employee-1",
  displayName: "Asha Rao",
  employeeCode: "E-101",
  periodStart: "2026-09-21",
  periodEnd: "2026-09-27",
  totalHours: "8",
  status: "SUBMITTED",
  remarks: null,
  reportingManagerEmployeeId: "manager-1",
  reportingManagerUserId: "user-1",
  lines: [
    {
      id: "line-1",
      version: 1,
      workDate: "2026-09-22",
      hours: "8",
      taskId: "task-1",
      workCategoryId: null,
      sourceType: null,
      remarks: "Implementation",
    },
  ],
  allowedActions: ["APPROVE", "RETURN"],
  actionRequirements: { expectedVersion: 3 },
};

vi.mock("../hooks/use-projects", () => ({
  useTeamTimesheets: () => ({
    data: { items: [sheet], total: 1, page: 1, limit: 20 },
    isLoading: false,
    error: null,
  }),
  useTimesheetTeamCommand: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe("TeamTimesheetsWorkspace review", () => {
  afterEach(cleanup);

  it("shows submitted lines before exposing approval actions", async () => {
    const user = userEvent.setup();
    render(<TeamTimesheetsWorkspace />);

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review" }));

    const dialog = screen.getByRole("dialog", { name: "Review timesheet" });
    expect(within(dialog).getByText(/2026-09-22 · 8 hours/)).toBeInTheDocument();
    expect(within(dialog).getByText("Implementation")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Return" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(
      await screen.findByRole("dialog", { name: "Approve timesheet" }),
    ).toBeInTheDocument();
  });
});
