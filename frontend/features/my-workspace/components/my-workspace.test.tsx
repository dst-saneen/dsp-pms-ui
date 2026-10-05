import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModuleCapabilities } from "@/hooks/use-module-capabilities";
import type {
  MyAssetsResponse,
  MyAttendanceException,
  MyOvertimeRequest,
  MyWorkspace as MyWorkspaceData,
} from "../types";
import { MyWorkspace } from "./my-workspace";

const state = vi.hoisted(() => ({
  user: {
    id: "user-1",
    employeeId: "employee-1" as string | null,
    authorization: { roles: ["EMPLOYEE"] as string[] },
  },
  hasPermission: vi.fn<(permission: string) => boolean>(),
  routerPush: vi.fn(),
  refreshSession: vi.fn(),
  workspaceRefetch: vi.fn(),
  exceptionsRefetch: vi.fn(),
  overtimeRefetch: vi.fn(),
  projectTasksRefetch: vi.fn(),
  timesheetsRefetch: vi.fn(),
  assetsRefetch: vi.fn(),
  payslipsRefetch: vi.fn(),
  optionalHolidaysRefetch: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  ownerLinkStatus: vi.fn(),
  repairOwnerEmployee: vi.fn(),
  workspace: null as MyWorkspaceData | null,
  workspaceIsLoading: false,
  workspaceError: null as Error | null,
  capabilities: null as ModuleCapabilities | null,
  exceptions: [] as MyAttendanceException[],
  exceptionsIsError: false,
  overtime: [] as MyOvertimeRequest[],
  overtimeIsError: false,
  assets: null as MyAssetsResponse | null,
  assetsIsLoading: false,
  assetsIsError: false,
  projectTasks: null as {
    items: Array<{
      id: string;
      projectId: string;
      projectName: string;
      projectCode: string;
      taskName: string;
      status: string;
      dueDate: string | null;
      allowedActions: string[];
    }>;
    total: number;
    page: number;
    limit: number;
  } | null,
  projectTasksIsLoading: false,
  projectTasksIsError: false,
  timesheets: null as {
    items: Array<{
      id: string;
      status: string;
      periodStart: string;
      periodEnd: string;
      lines: never[];
    }>;
    total: number;
    page: number;
    limit: number;
  } | null,
  timesheetsIsLoading: false,
  timesheetsIsError: false,
  payslips: [] as Array<{
    id: string;
    payrollYear: number;
    payrollMonth: number;
    status: string;
  }>,
  payslipsIsLoading: false,
  payslipsIsError: false,
  optionalHolidays: null as {
    year: number;
    timezone: string;
    maximumHolidayDays: number;
    mandatoryWorkingDayCount: number;
    optionalAllowance: number;
    selectedCount: number;
    remainingCount: number;
    holidays: Array<{
      eventId: string;
      date: string;
      name: string;
      calendarScope: "COMPANY" | "BRANCH";
      selected: boolean;
      selectionStatus: "NONE" | "SUBMITTED" | "APPROVED";
      locked: boolean;
      editableUntil: string;
    }>;
  } | null,
  optionalHolidaysIsLoading: false,
  optionalHolidaysIsError: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.routerPush }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: state.user,
    refreshSession: state.refreshSession,
    hasPermission: state.hasPermission,
  }),
}));

vi.mock("@/features/organization-onboarding/organization-onboarding-service", () => ({
  organizationOnboardingService: {
    status: state.ownerLinkStatus,
    repairOwnerEmployee: state.repairOwnerEmployee,
  },
}));

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({
    data: state.capabilities,
    isLoading: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../hooks/use-my-workspace", () => ({
  useMyWorkspace: () => ({
    data: state.workspace,
    isLoading: state.workspaceIsLoading,
    error: state.workspaceError,
    isFetching: false,
    refetch: state.workspaceRefetch,
  }),
  useMyAttendanceExceptions: () => ({
    data: state.exceptions,
    isLoading: false,
    isError: state.exceptionsIsError,
    refetch: state.exceptionsRefetch,
  }),
  useMyOvertime: () => ({
    data: state.overtime,
    isLoading: false,
    isError: state.overtimeIsError,
    refetch: state.overtimeRefetch,
  }),
  useMyAssets: () => ({
    data: state.assets,
    isLoading: state.assetsIsLoading,
    isError: state.assetsIsError,
    refetch: state.assetsRefetch,
  }),
  useSubmitMyRegularization: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAttendanceActions: () => ({
    checkIn: {
      mutate: state.checkIn,
      isPending: false,
      error: null,
    },
    checkOut: {
      mutate: state.checkOut,
      isPending: false,
      error: null,
    },
    errorMessage: null,
  }),
}));

vi.mock("@/features/projects/hooks/use-projects", () => ({
  useMyProjectTasks: () => ({
    data: state.projectTasks,
    isLoading: state.projectTasksIsLoading,
    isError: state.projectTasksIsError,
    refetch: state.projectTasksRefetch,
  }),
  useMyTimesheets: () => ({
    data: state.timesheets,
    isLoading: state.timesheetsIsLoading,
    isError: state.timesheetsIsError,
    refetch: state.timesheetsRefetch,
  }),
}));

vi.mock("@/features/payroll/hooks", () => ({
  useMyPayslips: () => ({
    data: state.payslips,
    isLoading: state.payslipsIsLoading,
    isError: state.payslipsIsError,
    refetch: state.payslipsRefetch,
  }),
  usePayslipDownloadGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/optional-holiday/hooks", () => ({
  useOptionalHolidays: () => ({
    data: state.optionalHolidays,
    isLoading: state.optionalHolidaysIsLoading,
    isError: state.optionalHolidaysIsError,
    refetch: state.optionalHolidaysRefetch,
  }),
  useUpdateOptionalHolidaySelections: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("./my-assets-card", () => ({ MyAssetsCard: () => <div>Asset details</div> }));
vi.mock("./my-payslips-card", () => ({ MyPayslipsCard: () => <div>Payslip details</div> }));
vi.mock("@/features/optional-holiday", () => ({
  OptionalHolidaySelectionCard: () => <div>Optional holiday details</div>,
}));
vi.mock("./submit-overtime-sheet", () => ({ SubmitOvertimeSheet: () => null }));
vi.mock("@/features/attendance-exception/dialogs/submit-regularization-sheet", () => ({
  SubmitRegularizationSheet: () => null,
}));
vi.mock("@/features/organization-onboarding/components/owner-employee-selection-dialog", () => ({
  OwnerEmployeeSelectionDialog: ({
    open,
    title,
    submitLabel,
    onSubmit,
  }: {
    open: boolean;
    title: string;
    submitLabel: string;
    onSubmit: (selection: {
      companyId: string;
      branchId: string;
      departmentId: string;
      designationId: string;
    }) => Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button
          type="button"
          onClick={() =>
            void onSubmit({
              companyId: "company-1",
              branchId: "branch-1",
              departmentId: "department-1",
              designationId: "designation-1",
            })
          }
        >
          {submitLabel}
        </button>
      </div>
    ) : null,
}));

function workspaceFixture(): MyWorkspaceData {
  return {
    identity: {
      userId: "user-1",
      employeeId: "employee-1",
      employeeCode: "EMP-1042",
      fullName: "Owner Admin",
      email: "owner@example.com",
      employmentStatus: "ACTIVE",
      company: { id: "company-1", companyName: "Dscape Technologies" },
      branch: { id: "branch-1", branchName: "Main Office", timezone: "Asia/Kolkata" },
      department: { id: "department-1", departmentName: "Engineering" },
      designation: { id: "designation-1", designationName: "Team Lead" },
      timezone: "Asia/Kolkata",
    },
    businessDate: "2026-09-24",
    timezone: "Asia/Kolkata",
    todayAttendance: null,
    todayShift: {
      workDate: "2026-09-24",
      dayType: "WORKING",
      shiftName: "General Shift",
      scheduledStartAt: "2026-09-24T03:30:00.000Z",
      scheduledEndAt: "2026-09-24T12:30:00.000Z",
    },
    punchReadiness: {
      businessDate: "2026-09-24",
      canCheckIn: true,
      canCheckOut: false,
      checkInBlockedReason: null,
      checkOutBlockedReason: "Check in first",
      setupHref: null,
    },
    todayWorkPlan: {
      itemCount: 3,
      items: [
        {
          id: "work-1",
          title: "Daily engineering stand-up",
          status: "UPCOMING",
          plannedStartTime: "2026-09-24T03:30:00.000Z",
          plannedEndTime: "2026-09-24T04:30:00.000Z",
        },
        {
          id: "work-2",
          title: "Product review",
          status: "UPCOMING",
          plannedStartTime: "2026-09-24T05:00:00.000Z",
          plannedEndTime: "2026-09-24T06:00:00.000Z",
        },
        {
          id: "work-3",
          title: "Prepare onboarding documents",
          status: "DUE_TODAY",
          plannedStartTime: null,
          plannedEndTime: null,
        },
      ],
    },
    leave: {
      summary: { totalEntitlement: 20, totalUsed: 8, totalPending: 0, totalBalance: 12 },
      balances: [],
      upcoming: [],
    },
    onboarding: {
      status: "IN_PROGRESS",
      progressPercent: 50,
      tasks: [
        {
          id: "onboarding-1",
          taskName: "Upload identification",
          status: "NOT_STARTED",
          dueDate: "2026-09-25",
          completedAt: null,
        },
        {
          id: "onboarding-2",
          taskName: "Confirm profile",
          status: "IN_PROGRESS",
          dueDate: "2026-09-25",
          completedAt: null,
        },
      ],
    },
    documents: {
      summary: { total: 3, verified: 2, pending: 1, expired: 0 },
      expiringSoon: 0,
      expired: 0,
    },
  };
}

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyWorkspace />
    </QueryClientProvider>
  );
}

describe("MyWorkspace compact workflow overview", () => {
  beforeEach(() => {
    state.user = {
      id: "user-1",
      employeeId: "employee-1",
      authorization: { roles: ["EMPLOYEE"] },
    };
    state.workspace = workspaceFixture();
    state.workspaceIsLoading = false;
    state.workspaceError = null;
    state.capabilities = {
      onboardingNav: true,
      projectsNav: true,
      assetSelfNav: true,
      assetsNav: true,
      payroll: true,
      payrollNav: true,
    } as ModuleCapabilities;
    state.exceptions = [
      {
        id: "exception-1",
        type: "MISSING_CHECK_OUT",
        status: "OPEN",
        businessDate: "2026-09-23",
        attendanceId: "attendance-1",
      },
    ];
    state.exceptionsIsError = false;
    state.overtime = [
      {
        id: "overtime-1",
        businessDate: "2026-09-23",
        eligibleMinutes: 90,
        status: "CALCULATED",
      },
    ];
    state.overtimeIsError = false;
    state.assets = {
      summary: {
        physicalAssigned: 1,
        activeLicenses: 1,
        acknowledgementPending: 1,
        openRequests: 0,
      },
      physicalAssignments: [],
      licenseAllocations: [],
    };
    state.assetsIsLoading = false;
    state.assetsIsError = false;
    state.projectTasks = {
      items: [
        {
          id: "task-1",
          projectId: "project-1",
          projectName: "ERP v2.0",
          projectCode: "ERP",
          taskName: "Daily engineering stand-up",
          status: "IN_PROGRESS",
          dueDate: "2026-09-25",
          allowedActions: ["LOG_TIME"],
        },
        {
          id: "task-2",
          projectId: "project-1",
          projectName: "ERP v2.0",
          projectCode: "ERP",
          taskName: "Product review",
          status: "NOT_STARTED",
          dueDate: "2026-09-26",
          allowedActions: ["START"],
        },
        {
          id: "task-3",
          projectId: "project-2",
          projectName: "Platform Team",
          projectCode: "PLATFORM",
          taskName: "Review pull requests",
          status: "IN_PROGRESS",
          dueDate: "2026-09-28",
          allowedActions: ["LOG_TIME"],
        },
      ],
      total: 3,
      page: 1,
      limit: 100,
    };
    state.projectTasksIsLoading = false;
    state.projectTasksIsError = false;
    state.timesheets = {
      items: [
        {
          id: "timesheet-1",
          status: "DRAFT",
          periodStart: "2026-09-21",
          periodEnd: "2026-09-27",
          lines: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    };
    state.timesheetsIsLoading = false;
    state.timesheetsIsError = false;
    state.payslips = [
      {
        id: "payslip-1",
        payrollYear: 2026,
        payrollMonth: 8,
        status: "AVAILABLE",
      },
    ];
    state.payslipsIsLoading = false;
    state.payslipsIsError = false;
    state.optionalHolidays = {
      year: 2026,
      timezone: "Asia/Kolkata",
      maximumHolidayDays: 3,
      mandatoryWorkingDayCount: 1,
      optionalAllowance: 2,
      selectedCount: 1,
      remainingCount: 1,
      holidays: [
        {
          eventId: "holiday-1",
          date: "2026-10-02",
          name: "Optional observance",
          calendarScope: "BRANCH",
          selected: false,
          selectionStatus: "NONE",
          locked: false,
          editableUntil: "2026-09-30T18:29:59.999Z",
        },
      ],
    };
    state.optionalHolidaysIsLoading = false;
    state.optionalHolidaysIsError = false;
    state.hasPermission.mockImplementation(() => true);
    for (const mock of [
      state.routerPush,
      state.refreshSession,
      state.workspaceRefetch,
      state.exceptionsRefetch,
      state.overtimeRefetch,
      state.projectTasksRefetch,
      state.timesheetsRefetch,
      state.assetsRefetch,
      state.payslipsRefetch,
      state.optionalHolidaysRefetch,
      state.checkIn,
      state.checkOut,
      state.ownerLinkStatus,
      state.repairOwnerEmployee,
    ]) {
      mock.mockReset();
      mock.mockResolvedValue(undefined);
    }
    state.ownerLinkStatus.mockResolvedValue({
      ownerEmployeeLink: { state: "LINKED", supportCode: null },
    });
    state.repairOwnerEmployee.mockResolvedValue({
      ownerEmployeeLink: { state: "LINKED", supportCode: null },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the approved task-first hierarchy without duplicate work or a leave metric card", () => {
    renderWorkspace();

    expect(
      screen.getByRole("heading", {
        name: /Good (morning|afternoon|evening), Owner Admin/,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in" })).toBeEnabled();

    const tasksSummary = screen.getByRole("link", { name: /My tasks/i });
    expect(tasksSummary).toHaveTextContent("3");
    expect(tasksSummary).toHaveTextContent("due this week");

    const projectsSummary = screen.getByRole("link", {
      name: "My projects: 2 assigned projects",
    });
    expect(projectsSummary).toHaveTextContent("2");

    const today = screen.getByRole("region", { name: "Today's work" });
    expect(within(today).getByText("Daily engineering stand-up")).toBeInTheDocument();
    expect(screen.getAllByText("Daily engineering stand-up")).toHaveLength(1);

    const applyLeave = screen.getByRole("link", { name: /Apply leave/i });
    expect(applyLeave).toHaveTextContent("12 days available");
    expect(applyLeave).toHaveAttribute("href", "/my-workspace/leave?action=apply");
    expect(screen.queryByRole("heading", { name: "Leave balance" })).not.toBeInTheDocument();
    expect(screen.queryByText("Update status")).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Personal records" })).toBeInTheDocument();
    expect(screen.getByText("2 assigned · 1 acknowledgement needed")).toBeInTheDocument();
    expect(screen.getByText("August 2026 payslip available")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();

    expect(screen.getByText(/Missing check-out · 23 Sep/i)).toBeInTheDocument();
    expect(screen.getByText("90 min overtime ready")).toBeInTheDocument();
    expect(screen.getByText("Timesheet pending")).toBeInTheDocument();
    expect(screen.getByText("2 onboarding tasks")).toBeInTheDocument();
    expect(screen.getByText("1 document needs attention")).toBeInTheDocument();
    expect(screen.getByText("1 asset acknowledgement pending")).toBeInTheDocument();
    expect(screen.getByText("Optional holiday selection")).toBeInTheDocument();
  });

  it("uses distinct workflow colors for quick self-service actions", () => {
    renderWorkspace();
    const quickSelfService = within(
      screen.getByRole("region", { name: "Quick self-service" })
    );

    const expectedTones = [
      ["Apply leave", "bg-orange-50/70", "text-orange-600"],
      ["Submit timesheet", "bg-emerald-50/70", "text-emerald-600"],
      ["HR request", "bg-blue-50/70", "text-blue-600"],
      ["My approvals", "bg-amber-50/70", "text-amber-600"],
      ["My projects", "bg-violet-50/70", "text-violet-600"],
      ["My assets", "bg-cyan-50/70", "text-cyan-600"],
    ] as const;

    for (const [name, backgroundClass, iconClass] of expectedTones) {
      const action = quickSelfService.getByRole("link", { name: new RegExp(name, "i") });
      expect(action).toHaveClass(backgroundClass);
      expect(action.querySelector("svg")).toHaveClass(iconClass);
    }
  });

  it("uses domain colors for personal record icons", () => {
    renderWorkspace();
    const personalRecords = within(screen.getByRole("region", { name: "Personal records" }));
    const expectedIconColors = [
      ["My assets & licences", "text-cyan-600"],
      ["Payslips", "text-emerald-600"],
      ["Optional holidays", "text-violet-600"],
    ] as const;

    for (const [name, iconClass] of expectedIconColors) {
      const row = personalRecords.getByRole("button", { name: new RegExp(name, "i") });
      expect(row.querySelector("svg")).toHaveClass(iconClass);
    }
  });

  it("refreshes every active overview query without changing status", async () => {
    renderWorkspace();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.workspaceRefetch).toHaveBeenCalledTimes(1);
    expect(state.exceptionsRefetch).toHaveBeenCalledTimes(1);
    expect(state.overtimeRefetch).toHaveBeenCalledTimes(1);
    expect(state.projectTasksRefetch).toHaveBeenCalledTimes(1);
    expect(state.timesheetsRefetch).toHaveBeenCalledTimes(1);
    expect(state.assetsRefetch).toHaveBeenCalledTimes(1);
    expect(state.payslipsRefetch).toHaveBeenCalledTimes(1);
    expect(state.optionalHolidaysRefetch).toHaveBeenCalledTimes(1);
    expect(state.checkIn).not.toHaveBeenCalled();
    expect(state.checkOut).not.toHaveBeenCalled();
  });

  it("offers only Check out after the employee has checked in", () => {
    const workspace = workspaceFixture();
    workspace.todayAttendance = {
      id: "attendance-1",
      status: "PRESENT",
      checkInTime: "2026-09-24T03:35:00.000Z",
      checkOutTime: null,
    };
    workspace.punchReadiness = {
      businessDate: "2026-09-24",
      canCheckIn: false,
      canCheckOut: true,
      checkInBlockedReason: "Already checked in",
      checkOutBlockedReason: null,
      setupHref: null,
    };
    state.workspace = workspace;

    renderWorkspace();

    expect(screen.getByText("Checked in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check out" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
  });

  it("shows a completed workday without another attendance mutation", () => {
    const workspace = workspaceFixture();
    workspace.todayAttendance = {
      id: "attendance-1",
      status: "PRESENT",
      checkInTime: "2026-09-24T03:35:00.000Z",
      checkOutTime: "2026-09-24T12:40:00.000Z",
    };
    workspace.punchReadiness = {
      businessDate: "2026-09-24",
      canCheckIn: false,
      canCheckOut: false,
      checkInBlockedReason: "Workday already completed",
      checkOutBlockedReason: "Workday already completed",
      setupHref: null,
    };
    state.workspace = workspace;

    renderWorkspace();

    expect(screen.getByText("Workday complete")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check out" })).not.toBeInTheDocument();
  });

  it("explains an approved-leave attendance block without offering a punch action", () => {
    const workspace = workspaceFixture();
    workspace.punchReadiness = {
      businessDate: "2026-09-24",
      canCheckIn: false,
      canCheckOut: false,
      checkInBlockedReason: "Approved leave covers this workday.",
      checkOutBlockedReason: "Check in first",
      setupHref: null,
    };
    state.workspace = workspace;

    renderWorkspace();

    expect(screen.getByTestId("check-in-blocked-reason")).toHaveTextContent(
      "Approved leave covers this workday."
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
  });

  it("keeps a missing schedule state compact without HR guidance or a calendar link", () => {
    const workspace = workspaceFixture();
    workspace.todayShift = null;
    workspace.punchReadiness = {
      businessDate: "2026-09-24",
      canCheckIn: false,
      canCheckOut: false,
      checkInBlockedReason:
        "No published work schedule for today. Ask HR to publish a Work Schedule covering this date, then open My calendar to confirm.",
      checkOutBlockedReason: "Check in first",
      setupHref: "/my-workspace/calendar",
    };
    state.workspace = workspace;

    renderWorkspace();

    expect(screen.getByText("No published shift today")).toBeInTheDocument();
    expect(screen.queryByText(/No published work schedule for today/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open my calendar" })).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("renders clear empty states when no work or attention data exists", () => {
    const workspace = workspaceFixture();
    workspace.todayWorkPlan = { itemCount: 0, items: [] };
    workspace.onboarding.tasks = [];
    workspace.documents = {
      summary: { total: 0, verified: 0, pending: 0, expired: 0 },
      expiringSoon: 0,
      expired: 0,
    };
    state.workspace = workspace;
    state.exceptions = [];
    state.overtime = [];
    state.timesheets = { items: [], total: 0, page: 1, limit: 100 };
    state.assets = {
      summary: {
        physicalAssigned: 0,
        activeLicenses: 0,
        acknowledgementPending: 0,
        openRequests: 0,
      },
      physicalAssignments: [],
      licenseAllocations: [],
    };
    state.optionalHolidays = {
      ...state.optionalHolidays!,
      selectedCount: 2,
      remainingCount: 0,
    };

    renderWorkspace();

    expect(screen.getByText("No work-plan items scheduled for today.")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs action")).toBeInTheDocument();
  });

  it("keeps healthy workflow data visible when an independent widget fails", () => {
    state.exceptions = [];
    state.exceptionsIsError = true;

    renderWorkspace();

    expect(screen.getByText("Attendance attention unavailable")).toBeInTheDocument();
    expect(screen.getByText("90 min overtime ready")).toBeInTheDocument();
    expect(screen.getByText("Daily engineering stand-up")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.exceptionsRefetch).toHaveBeenCalledTimes(1);
  });

  it("offers a retry when genuine timesheet status cannot be loaded", () => {
    state.timesheets = null;
    state.timesheetsIsError = true;

    renderWorkspace();

    expect(screen.getByText("Timesheet status unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.timesheetsRefetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Timesheet pending")).not.toBeInTheDocument();
  });

  it("does not present zero project or record counts while queries are loading", () => {
    state.projectTasks = null;
    state.projectTasksIsLoading = true;
    state.assets = null;
    state.assetsIsLoading = true;
    state.payslips = [];
    state.payslipsIsLoading = true;

    renderWorkspace();

    const tasksSummary = screen.getByRole("link", { name: "My tasks: — Loading…" });
    const projectsSummary = screen.getByRole("link", {
      name: "My projects: — Loading…",
    });
    expect(tasksSummary).toHaveTextContent("Loading…");
    expect(projectsSummary).toHaveTextContent("Loading…");
    expect(tasksSummary).not.toHaveTextContent("0");
    expect(projectsSummary).not.toHaveTextContent("0");
    expect(screen.getByText("Loading records")).toBeInTheDocument();
    expect(screen.getByText("Loading payslips")).toBeInTheDocument();
  });

  it("does not ask for an optional-holiday decision when every remaining choice is locked", () => {
    state.optionalHolidays = {
      ...state.optionalHolidays!,
      holidays: state.optionalHolidays!.holidays.map((holiday) => ({
        ...holiday,
        locked: true,
      })),
    };

    renderWorkspace();

    expect(screen.queryByText("Optional holiday selection")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Optional holidays/i })).toBeInTheDocument();
  });

  it("shows the standard unlinked-user state without exposing self-service actions", () => {
    state.user = {
      id: "user-1",
      employeeId: null,
      authorization: { roles: ["EMPLOYEE"] },
    };

    renderWorkspace();

    expect(screen.getByText("Employee link required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByText("Quick self-service")).not.toBeInTheDocument();
  });

  it("preserves the organization-owner repair workflow", async () => {
    state.user = {
      id: "owner-1",
      employeeId: null,
      authorization: { roles: ["ORGANIZATION_OWNER"] },
    };
    state.ownerLinkStatus.mockResolvedValue({
      ownerEmployeeLink: { state: "NEEDS_REPAIR", supportCode: "OWNER-LINK-42" },
    });

    renderWorkspace();

    expect(await screen.findByText(/OWNER-LINK-42/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose assignment and retry" }));
    expect(
      screen.getByRole("dialog", { name: "Repair owner employee assignment" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Repair employee link" }));
    await waitFor(() => expect(state.repairOwnerEmployee).toHaveBeenCalledTimes(1));
    expect(state.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("hides project, asset, and payroll affordances when capabilities are disabled", () => {
    state.capabilities = {
      onboardingNav: false,
      projectsNav: false,
      assetSelfNav: false,
      assetsNav: false,
      payroll: false,
      payrollNav: false,
    } as ModuleCapabilities;

    renderWorkspace();

    expect(screen.queryByText("My tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("My projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit timesheet")).not.toBeInTheDocument();
    expect(screen.queryByText("My assets & licences")).not.toBeInTheDocument();
    expect(screen.queryByText("Payslips")).not.toBeInTheDocument();
    expect(screen.queryByText("Timesheet pending")).not.toBeInTheDocument();
    expect(screen.queryByText("asset acknowledgement pending")).not.toBeInTheDocument();
  });

  it("uses a contact-HR state when document navigation is not permitted", () => {
    state.hasPermission.mockImplementation((permission) => permission !== "hr.documents.read");

    const { container } = renderWorkspace();

    expect(screen.getByText("Contact HR")).toBeInTheDocument();
    expect(container.querySelector('a[href="/hr/employee-documents"]')).toBeNull();
  });

  it("expands personal record details in place", () => {
    renderWorkspace();

    const assetsRow = screen.getByRole("button", { name: /My assets & licences/i });
    expect(assetsRow).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(assetsRow);
    expect(assetsRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Asset details")).toBeInTheDocument();
  });
});
