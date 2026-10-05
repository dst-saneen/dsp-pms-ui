import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyWorkspaceCalendarPage from "./page";

const state = vi.hoisted(() => ({
  hasPermission: vi.fn<(permission: string) => boolean>(),
  user: { employeeId: "employee-1" } as { employeeId?: string } | null,
  workspaceRefetch: vi.fn(),
  calendarRefetch: vi.fn(),
  holidayRefetch: vi.fn(),
  leaveRefetch: vi.fn(),
  routerPush: vi.fn(),
  workspace: {
    data: undefined as unknown,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
  },
  calendar: {
    data: undefined as unknown,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as Error | null,
  },
  holidays: {
    data: [] as unknown,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as Error | null,
  },
  leave: {
    data: undefined as unknown,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as Error | null,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.routerPush }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: state.user,
    hasPermission: state.hasPermission,
  }),
}));

vi.mock("@/features/my-workspace/hooks/use-my-workspace", () => ({
  useMyWorkspace: () => ({
    ...state.workspace,
    refetch: state.workspaceRefetch,
  }),
  useMyWorkforceCalendar: () => ({
    ...state.calendar,
    refetch: state.calendarRefetch,
  }),
  useMyHolidayCalendar: () => ({
    ...state.holidays,
    refetch: state.holidayRefetch,
  }),
  useMyLeave: () => ({
    ...state.leave,
    refetch: state.leaveRefetch,
  }),
}));

vi.mock("@/features/my-workspace/components/apply-leave-sheet", () => ({
  ApplyLeaveSheet: () => null,
}));

const workspaceData = {
  businessDate: "2026-09-16",
  timezone: "Asia/Kolkata",
  identity: {
    userId: "user-1",
    employeeId: "employee-1",
    employeeCode: "EMP-001",
    fullName: "Rohan Kumar",
    email: "rohan@example.com",
    employmentStatus: "ACTIVE",
    company: { id: "company-1", companyName: "Dscape Technologies" },
    branch: {
      id: "branch-1",
      branchName: "Main Office",
      timezone: "Asia/Kolkata",
    },
    department: { id: "department-1", departmentName: "Engineering" },
    designation: { id: "designation-1", designationName: "Team Lead" },
    timezone: "Asia/Kolkata",
  },
  todayAttendance: null,
  todayShift: {
    workDate: "2026-09-16",
    dayType: "WORKING",
    shiftName: "General Shift",
    scheduledStartAt: "2026-09-16T03:30:00.000Z",
    scheduledEndAt: "2026-09-16T12:30:00.000Z",
  },
  leave: {
    summary: { totalEntitlement: 18, totalUsed: 5, totalPending: 1, totalBalance: 12 },
    balances: [
      {
        leaveTypeId: "annual",
        leaveCode: "AL",
        leaveName: "Annual Leave",
        entitlement: 18,
        used: 5,
        pending: 1,
        balance: 12,
      },
    ],
    upcoming: [],
  },
  onboarding: { status: "COMPLETED", progressPercent: 100, tasks: [] },
  documents: {
    summary: { total: 0, verified: 0, pending: 0, expired: 0 },
    expiringSoon: 0,
    expired: 0,
  },
};

const calendarData = {
  days: [
    {
      date: "2026-09-16",
      employees: [
        {
          employeeId: "employee-1",
          state: "SCHEDULED",
          dayType: "WORKING",
          shiftName: "General Shift",
        },
      ],
    },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  state.user = { employeeId: "employee-1" };
  state.hasPermission.mockReset();
  state.hasPermission.mockImplementation((permission) => permission === "hr.self.manage");
  state.workspaceRefetch.mockReset();
  state.workspaceRefetch.mockResolvedValue({});
  state.calendarRefetch.mockReset();
  state.calendarRefetch.mockResolvedValue({});
  state.holidayRefetch.mockReset();
  state.holidayRefetch.mockResolvedValue({});
  state.leaveRefetch.mockReset();
  state.leaveRefetch.mockResolvedValue({});
  state.routerPush.mockReset();
  state.workspace.data = workspaceData;
  state.workspace.isLoading = false;
  state.workspace.isFetching = false;
  state.workspace.error = null;
  state.calendar.data = calendarData;
  state.calendar.isLoading = false;
  state.calendar.isFetching = false;
  state.calendar.isError = false;
  state.calendar.error = null;
  state.holidays.data = [];
  state.holidays.isLoading = false;
  state.holidays.isFetching = false;
  state.holidays.isError = false;
  state.holidays.error = null;
  state.leave.data = undefined;
  state.leave.isLoading = false;
  state.leave.isFetching = false;
  state.leave.isError = false;
  state.leave.error = null;
});

describe("MyWorkspaceCalendarPage", () => {
  it("renders the compact workflow header and refreshes calendar and balances", async () => {
    const user = userEvent.setup();
    render(<MyWorkspaceCalendarPage />);

    expect(screen.getByRole("heading", { name: "My calendar" })).toBeVisible();
    expect(screen.getByText("View your schedule, leave, and important dates.")).toBeVisible();
    expect(
      screen.getByRole("gridcell", { name: /16 today general shift/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Apply leave" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh calendar" }));
    expect(state.calendarRefetch).toHaveBeenCalledTimes(1);
    expect(state.workspaceRefetch).toHaveBeenCalledTimes(1);
  });

  it("uses the branch business date as the initial visible month", () => {
    state.workspace.data = { ...workspaceData, businessDate: "2026-10-03" };
    state.calendar.data = { days: [] };

    render(<MyWorkspaceCalendarPage />);

    expect(screen.getByText("October 2026")).toBeVisible();
  });

  it("opens the full My leave workspace from the compact Leave tab", async () => {
    const user = userEvent.setup();
    render(<MyWorkspaceCalendarPage />);

    await user.click(screen.getByRole("tab", { name: "Leave" }));
    await user.click(screen.getByRole("button", { name: "Open My leave" }));
    expect(state.routerPush).toHaveBeenCalledWith("/my-workspace/leave");
  });

  it("routes a selected date into the canonical leave application flow", async () => {
    const user = userEvent.setup();
    render(<MyWorkspaceCalendarPage />);

    await user.click(screen.getByRole("gridcell", { name: /16 today general shift/i }));
    await user.click(screen.getByRole("button", { name: /Apply leave for this date/i }));
    expect(state.routerPush).toHaveBeenCalledWith(
      "/my-workspace/leave?action=apply&fromDate=2026-09-16"
    );
  });

  it("hides leave actions without permission", () => {
    state.hasPermission.mockReturnValue(false);
    render(<MyWorkspaceCalendarPage />);

    expect(screen.queryByRole("button", { name: "Apply leave" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Apply leave for this date/i })
    ).not.toBeInTheDocument();
  });

  it("shows a concise linked-employee state when no profile is linked", () => {
    state.user = { employeeId: undefined };
    render(<MyWorkspaceCalendarPage />);

    expect(screen.getByText("Employee profile not linked")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Refresh calendar" })).not.toBeInTheDocument();
  });
});
