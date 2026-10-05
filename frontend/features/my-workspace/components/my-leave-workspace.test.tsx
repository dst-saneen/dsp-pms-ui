import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyLeaveWorkspace } from "./my-leave-workspace";

const state = vi.hoisted(() => ({
  user: { employeeId: "employee-1" } as { employeeId?: string } | null,
  canManage: true,
  routerReplace: vi.fn(),
  workspaceRefetch: vi.fn(),
  leaveRefetch: vi.fn(),
  useMyLeave: vi.fn(),
  workspace: {
    data: { businessDate: "2026-09-24" } as unknown,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
  },
  leave: {
    data: undefined as unknown,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.routerReplace }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: state.user,
    hasPermission: (permission: string) => permission === "hr.self.manage" && state.canManage,
  }),
}));

vi.mock("@/features/my-workspace/hooks/use-my-workspace", () => ({
  useMyWorkspace: () => ({ ...state.workspace, refetch: state.workspaceRefetch }),
  useMyLeave: (year: number, enabled: boolean) => state.useMyLeave(year, enabled),
}));

vi.mock("@/features/my-workspace/components/apply-leave-sheet", () => ({
  ApplyLeaveSheet: ({
    open,
    onOpenChange,
    defaultFromDate,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultFromDate?: string;
  }) => open ? <div role="dialog" aria-label="Apply leave sheet">
    <span>{defaultFromDate ?? "No prefilled date"}</span>
    <button type="button" onClick={() => onOpenChange(false)}>Close leave sheet</button>
  </div> : null,
}));

const leaveData = {
  summary: { totalEntitlement: 18, totalUsed: 5, totalPending: 1, totalBalance: 12 },
  balances: [{
    leaveTypeId: "annual",
    leaveCode: "AL",
    leaveName: "Annual Leave",
    entitlement: 18,
    used: 5,
    pending: 1,
    balance: 12,
  }],
  history: [{
    id: "request-1",
    leaveType: "Annual Leave",
    fromDate: "2026-10-01",
    toDate: "2026-10-02",
    requestedDays: 2,
    status: "SUBMITTED",
    createdAt: "2026-09-01T00:00:00.000Z",
  }],
  upcoming: [{
    id: "request-2",
    leaveType: "Sick Leave",
    fromDate: "2026-10-10",
    toDate: "2026-10-10",
    approvedDays: 1,
    status: "APPROVED",
  }],
};

afterEach(cleanup);

beforeEach(() => {
  state.user = { employeeId: "employee-1" };
  state.canManage = true;
  state.routerReplace.mockReset();
  state.workspaceRefetch.mockReset();
  state.workspaceRefetch.mockResolvedValue({});
  state.leaveRefetch.mockReset();
  state.leaveRefetch.mockResolvedValue({});
  state.workspace.data = { businessDate: "2026-09-24" };
  state.workspace.isLoading = false;
  state.workspace.isFetching = false;
  state.workspace.error = null;
  state.leave.data = leaveData;
  state.leave.isLoading = false;
  state.leave.isFetching = false;
  state.leave.error = null;
  state.useMyLeave.mockReset();
  state.useMyLeave.mockImplementation(() => ({ ...state.leave, refetch: state.leaveRefetch }));
});

describe("MyLeaveWorkspace", () => {
  it("renders the approved action-first workflow without unsupported request actions", () => {
    state.leave.data = {
      summary: { totalEntitlement: 35, totalUsed: 99, totalPending: 99, totalBalance: 99 },
      balances: [
        {
          leaveTypeId: "annual",
          leaveCode: "ANL",
          leaveName: "Annual Leave",
          entitlement: 20,
          used: 8,
          pending: 2,
          balance: 10,
        },
        {
          leaveTypeId: "sick",
          leaveCode: "SICK",
          leaveName: "Sick Leave",
          entitlement: 10,
          used: 2,
          pending: 0,
          balance: 8,
        },
        {
          leaveTypeId: "comp",
          leaveCode: "COMP",
          leaveName: "Comp-off",
          entitlement: 5,
          used: 3,
          pending: 0,
          balance: 2,
        },
      ],
      history: [
        ...leaveData.history,
        {
          id: "old-request",
          leaveType: "Annual Leave",
          fromDate: "2025-12-20",
          toDate: "2025-12-20",
          requestedDays: 1,
          status: "APPROVED",
          createdAt: "2025-11-10T00:00:00.000Z",
        },
      ],
      upcoming: leaveData.upcoming,
    };

    render(<MyLeaveWorkspace />);

    expect(screen.getByText("Check your leave balance, track requests, and apply when you need time away.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Leave year" })).not.toBeInTheDocument();

    const position = screen.getByRole("region", { name: "Leave position · 2026" });
    expect(within(position).getByText("20 days")).toBeVisible();
    expect(within(position).getByText("13 days")).toBeVisible();
    expect(within(position).getByText("2 days")).toBeVisible();
    expect(within(position).getByText("across 3 leave types")).toBeVisible();
    expect(within(position).getByText("10 Oct 2026")).toBeVisible();
    expect(within(position).getByTestId("leave-position-grid")).toHaveClass("gap-2", "px-3", "pb-3", "pt-2");
    for (const label of ["Available leave", "Used leave", "Pending leave", "Next upcoming leave"]) {
      expect(within(position).getByRole("article", { name: label })).toHaveClass("min-h-[72px]", "rounded-md", "border-0");
    }
    expect(
      within(position).getByRole("link", { name: "View next upcoming leave in calendar" })
    ).toHaveAttribute("href", "/my-workspace/calendar");

    expect(screen.getByRole("heading", { name: "Leave balances · 2026" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Upcoming leave" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "My leave requests · 2026" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Pending approval 1/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Created on" })).toBeVisible();
    expect(screen.queryByText("Submitted on")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByText("View all types")).not.toBeInTheDocument();
    expect(screen.queryByText("20 Dec 2025")).not.toBeInTheDocument();
  });

  it("shows annual KPIs, balances, detailed history, and the branch business year", () => {
    render(<MyLeaveWorkspace />);

    expect(screen.getByRole("heading", { name: "My leave" })).toBeVisible();
    expect(screen.getByLabelText("Leave year")).toHaveValue("2026");
    expect(screen.getByText("Available leave")).toBeVisible();
    expect(screen.getByText("Used leave")).toBeVisible();
    expect(within(screen.getByRole("article", { name: "Pending leave" })).getByText("Pending")).toBeVisible();
    expect(screen.getByText("Upcoming leave")).toBeVisible();
    expect(within(screen.getByRole("table", { name: "Leave balances by type" })).getByRole("rowheader", { name: /Annual Leave/ })).toBeVisible();
    expect(screen.getByRole("table", { name: "Leave requests" })).toBeVisible();
    expect(state.useMyLeave).toHaveBeenCalledWith(2026, true);
  });

  it("changes the reporting year through the canonical URL", () => {
    render(<MyLeaveWorkspace />);

    fireEvent.change(screen.getByLabelText("Leave year"), { target: { value: "2025" } });

    expect(state.routerReplace).toHaveBeenCalledWith("/my-workspace/leave?year=2025", { scroll: false });
    expect(state.useMyLeave).toHaveBeenLastCalledWith(2025, true);
  });

  it("filters legacy submitted requests under the single Pending approval state", async () => {
    const user = userEvent.setup();
    state.leave.data = {
      ...leaveData,
      history: [
        {
          id: "legacy-pending",
          leaveType: "Sick Leave",
          fromDate: "2026-11-03",
          toDate: "2026-11-04",
          requestedDays: 2,
          status: "PENDING",
          createdAt: "2026-10-28T00:00:00.000Z",
        },
        {
          id: "approved-request",
          leaveType: "Annual Leave",
          fromDate: "2026-10-12",
          toDate: "2026-10-14",
          requestedDays: 3,
          status: "APPROVED",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    };
    render(<MyLeaveWorkspace />);

    await user.click(screen.getByRole("button", { name: /Pending approval 1/ }));

    const requests = screen.getByRole("table", { name: "Leave requests" });
    expect(within(requests).getByText("Sick Leave")).toBeVisible();
    expect(within(requests).getByText("Pending approval")).toBeVisible();
    expect(within(requests).queryByText("Annual Leave")).not.toBeInTheDocument();
  });

  it("derives pending days from the pending requests shown to the employee", () => {
    state.leave.data = {
      ...leaveData,
      balances: [{ ...leaveData.balances[0], pending: 0 }],
      history: [{ ...leaveData.history[0], requestedDays: 2 }],
    };
    render(<MyLeaveWorkspace />);

    expect(within(screen.getByRole("article", { name: "Pending leave" })).getByText("2 days")).toBeVisible();
  });

  it("uses a compact same-month date range for the next upcoming leave", () => {
    state.leave.data = {
      ...leaveData,
      upcoming: [{ ...leaveData.upcoming[0], fromDate: "2026-10-01", toDate: "2026-10-02", approvedDays: 2 }],
    };
    render(<MyLeaveWorkspace />);

    expect(within(screen.getByRole("article", { name: "Next upcoming leave" })).getByText("01–02 Oct 2026")).toBeVisible();
  });

  it("provides stacked leave balance and request records for narrow screens", () => {
    render(<MyLeaveWorkspace />);

    expect(within(screen.getByLabelText("Leave balances mobile")).getByText(/Annual Leave/)).toBeVisible();
    expect(within(screen.getByLabelText("Leave requests mobile")).getByText("Annual Leave")).toBeVisible();
  });

  it("opens from query state with a prefilled date and cleans the URL on close", async () => {
    const user = userEvent.setup();
    render(<MyLeaveWorkspace initialYear={2026} initialApplyOpen initialFromDate="2026-10-03" />);

    expect(screen.getByRole("dialog", { name: "Apply leave sheet" })).toHaveTextContent("2026-10-03");
    await user.click(screen.getByRole("button", { name: "Close leave sheet" }));
    expect(state.routerReplace).toHaveBeenCalledWith("/my-workspace/leave?year=2026", { scroll: false });
  });

  it("keeps leave records readable while hiding application controls without manage permission", () => {
    state.canManage = false;
    render(<MyLeaveWorkspace initialApplyOpen />);

    expect(screen.getByRole("table", { name: "Leave requests" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Apply leave" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Apply leave sheet" })).not.toBeInTheDocument();
  });

  it("shows compact empty states and keeps a single Apply leave action", () => {
    state.leave.data = {
      summary: { totalEntitlement: 0, totalUsed: 0, totalPending: 0, totalBalance: 0 },
      balances: [],
      history: [],
      upcoming: [],
    };
    render(<MyLeaveWorkspace />);

    const emptyBalances = screen.getByRole("status", { name: "No leave balances" });
    const emptyUpcoming = screen.getByRole("status", { name: "No upcoming leave" });
    expect(emptyBalances).toHaveClass("min-h-28");
    expect(within(emptyBalances).getByText("No leave balances")).toBeVisible();
    expect(within(emptyBalances).getByText("Leave balances will appear when a policy is assigned for 2026.")).toBeVisible();
    expect(emptyUpcoming).toHaveClass("min-h-28");
    expect(within(emptyUpcoming).getByText("Approved or pending leave will appear here.")).toBeVisible();
    const emptyRequests = screen.getByRole("status", { name: "No leave requests for 2026" });
    expect(emptyRequests).toHaveClass("min-h-28");
    expect(within(emptyRequests).getByText("Your applications and approval results will appear here.")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Filter leave requests" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Available leave" })).getByText("Not available")).toBeVisible();
    expect(within(screen.getByRole("article", { name: "Used leave" })).getByText("Not available")).toBeVisible();
    expect(screen.getByText("No leave requests for 2026")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Apply leave" })).toHaveLength(1);
  });

  it("keeps a retry action available when annual leave data fails", async () => {
    const user = userEvent.setup();
    state.leave.error = new Error("Leave request failed");
    render(<MyLeaveWorkspace />);

    expect(screen.getByText("Could not load My leave")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry leave" }));
    expect(state.leaveRefetch).toHaveBeenCalledOnce();
  });

  it("shows a linked-employee state instead of loading employee leave data", () => {
    state.user = { employeeId: undefined };
    render(<MyLeaveWorkspace />);

    expect(screen.getByText("Employee profile not linked")).toBeVisible();
    expect(state.useMyLeave).toHaveBeenCalledWith(2026, false);
  });
});
