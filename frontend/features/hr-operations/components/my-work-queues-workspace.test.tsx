import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyWorkQueuesWorkspace } from "./my-work-queues-workspace";

vi.mock("../hooks", () => ({
  useClearanceCommand: vi.fn(),
  useClearanceQueue: vi.fn(),
  useHrRequestCommand: vi.fn(),
  usePendingHrRequestApprovals: vi.fn(),
  usePendingSeparationApprovals: vi.fn(),
  useSeparationCommand: vi.fn(),
}));

import {
  useClearanceCommand,
  useClearanceQueue,
  useHrRequestCommand,
  usePendingHrRequestApprovals,
  usePendingSeparationApprovals,
  useSeparationCommand,
} from "../hooks";
import type { EmployeeClearanceItem, EmployeeSeparation, HrRequest, PageResult } from "../types";

const refetchRequests = vi.fn();
const refetchSeparations = vi.fn();
const refetchClearance = vi.fn();

const hrRequests: HrRequest[] = [
  {
    id: "request-1",
    companyId: "company-1",
    branchId: "branch-head",
    branch: { id: "branch-head", branchCode: "HO", branchName: "Head Office" },
    employeeId: "employee-neha",
    requestTypeId: "type-letter",
    requestNo: "HR-0042",
    requestDate: "2026-09-18",
    remarks: "Needed for the bank",
    status: "PENDING_APPROVAL",
    version: 3,
    createdAt: "2026-09-18T09:00:00.000Z",
    employee: {
      id: "employee-neha",
      employeeCode: "EMP-1007",
      displayName: "Neha Singh",
      department: { id: "dept-ops", departmentCode: "OPS", departmentName: "Operations" },
      designation: {
        id: "des-exec",
        designationCode: "EXEC",
        designationName: "Operations Executive",
      },
    },
    requestType: {
      id: "type-letter",
      requestCode: "EMP-LETTER",
      requestName: "Employment letter",
      isActive: true,
    },
    allowedActions: ["APPROVE"],
  },
  {
    id: "request-2",
    companyId: "company-1",
    branchId: "branch-regional",
    branch: { id: "branch-regional", branchCode: "RO", branchName: "Regional Office" },
    employeeId: "employee-vikram",
    requestTypeId: "type-payroll",
    requestNo: "HR-0043",
    requestDate: "2026-09-19",
    status: "APPROVED",
    version: 1,
    createdAt: "2026-09-19T09:00:00.000Z",
    employee: {
      id: "employee-vikram",
      employeeCode: "EMP-1019",
      displayName: "Vikram Nair",
    },
    requestType: {
      id: "type-payroll",
      requestCode: "PAYROLL",
      requestName: "Payroll correction",
      isActive: true,
    },
    attachment: {
      present: true,
      fileName: "payroll-proof.pdf",
      status: "CLEAN",
    },
    approvalTransaction: {
      currentStep: 2,
      status: "PENDING",
      pendingApprover: { id: "manager-meera", displayName: "Meera Shah" },
    },
    allowedActions: [],
  },
];

const separations: EmployeeSeparation[] = [
  {
    id: "separation-1",
    companyId: "company-1",
    branchId: "branch-head",
    branch: { id: "branch-head", branchCode: "HO", branchName: "Head Office" },
    employeeId: "employee-aarav",
    separationType: "RESIGNATION",
    lastWorkingDate: "2026-09-30",
    reason: "Personal reasons",
    status: "PENDING_APPROVAL",
    version: 2,
    createdAt: "2026-09-17T09:00:00.000Z",
    employee: {
      id: "employee-aarav",
      employeeCode: "EMP-1036",
      displayName: "Aarav Mehta",
    },
    clearanceSummary: {
      mandatoryTotal: 4,
      mandatoryCleared: 3,
      mandatoryOutstanding: 1,
      assetClearanceBlocked: false,
    },
    allowedActions: ["APPROVE", "REJECT"],
  },
];

const clearanceItems: EmployeeClearanceItem[] = [
  {
    id: "clearance-1",
    separationId: "separation-1",
    executorDepartmentId: "dept-it",
    executorDepartmentName: "IT",
    itemType: "ASSET",
    title: "Laptop Return",
    mandatory: true,
    status: "PENDING",
    version: 4,
    employee: {
      id: "employee-neha",
      employeeCode: "EMP-1007",
      displayName: "Neha Singh",
      department: { id: "dept-ops", departmentCode: "OPS", departmentName: "Operations" },
      designation: {
        id: "des-exec",
        designationCode: "EXEC",
        designationName: "Operations Executive",
      },
    },
    branch: { id: "branch-head", branchCode: "HO", branchName: "Head Office" },
    separation: {
      id: "separation-1",
      separationType: "RESIGNATION",
      lastWorkingDate: "2026-09-30",
      reason: "Personal reasons",
      createdAt: "2026-09-17T09:00:00.000Z",
    },
    allowedActions: ["CLEAR"],
  },
  {
    id: "clearance-2",
    separationId: "separation-2",
    executorDepartmentId: "dept-finance",
    executorDepartmentName: "Finance",
    itemType: "FINANCE",
    title: "Final Settlement",
    mandatory: true,
    status: "CLEARED",
    version: 2,
    clearedAt: "2026-09-20T10:30:00.000Z",
    clearedBy: { id: "employee-priya", displayName: "Priya Nair" },
    employee: {
      id: "employee-vikram",
      employeeCode: "EMP-1019",
      displayName: "Vikram Nair",
    },
    branch: { id: "branch-regional", branchCode: "RO", branchName: "Regional Office" },
    separation: {
      id: "separation-2",
      separationType: "TERMINATION",
      lastWorkingDate: "2026-09-25",
      createdAt: "2026-09-15T09:00:00.000Z",
    },
    allowedActions: [],
  },
];

const queryState = {
  isLoading: false,
  isFetching: false,
  error: null,
};

function page<T>(items: T[]): PageResult<T> {
  return { items, total: items.length, page: 1, limit: 50 };
}

function mockQueues({
  requests = hrRequests,
  separationRows = separations,
  clearances = clearanceItems,
}: {
  requests?: HrRequest[];
  separationRows?: EmployeeSeparation[];
  clearances?: EmployeeClearanceItem[];
} = {}) {
  vi.mocked(usePendingHrRequestApprovals).mockReturnValue({
    ...queryState,
    data: page(requests),
    refetch: refetchRequests,
  } as never);
  vi.mocked(usePendingSeparationApprovals).mockReturnValue({
    ...queryState,
    data: page(separationRows),
    refetch: refetchSeparations,
  } as never);
  vi.mocked(useClearanceQueue).mockReturnValue({
    ...queryState,
    data: page(clearances),
    refetch: refetchClearance,
  } as never);
}

describe("MyWorkQueuesWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueues();
    vi.mocked(useHrRequestCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useSeparationCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useClearanceCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("shows accurate totals and keeps approval and clearance rows in separate tabs", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    expect(screen.getByLabelText("4 awaiting my action")).toBeVisible();
    expect(screen.getByLabelText("3 approvals")).toBeVisible();
    expect(screen.getByLabelText("2 HR requests")).toBeVisible();
    expect(screen.getByLabelText("1 separation")).toBeVisible();
    expect(screen.getByLabelText("2 clearance items")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Approvals 3" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("row", { name: "Open Employment letter" })).toBeVisible();
    expect(screen.getByRole("row", { name: "Open Resignation" })).toBeVisible();
    expect(screen.queryByRole("row", { name: "Open Laptop Return" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Department clearance 2" }));

    expect(screen.getByRole("row", { name: "Open Laptop Return" })).toBeVisible();
    expect(screen.getByRole("row", { name: "Open Final Settlement" })).toBeVisible();
    expect(screen.queryByRole("row", { name: "Open Employment letter" })).not.toBeInTheDocument();
  });

  it("does not count view-only pending clearance as awaiting my action", () => {
    mockQueues({
      requests: [],
      separationRows: [],
      clearances: [{ ...clearanceItems[0], allowedActions: [] }],
    });

    render(<MyWorkQueuesWorkspace />);

    expect(screen.getByLabelText("0 awaiting my action")).toBeVisible();
    expect(screen.getByLabelText("1 clearance item")).toBeVisible();
  });

  it("offers only the requirement value supported by the clearance API", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Department clearance 2" }));

    const requirement = screen.getByLabelText("Requirement");
    expect(within(requirement).getByRole("option", { name: "Mandatory" })).toBeInTheDocument();
    expect(within(requirement).queryByRole("option", { name: "Optional" })).not.toBeInTheDocument();
  });

  it("keeps both tabs usable and opens full-width filters on a narrow viewport", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );

    render(<MyWorkQueuesWorkspace />);

    const tabs = screen.getByRole("tablist", { name: "Approval queues" });
    expect(tabs).toHaveClass("overflow-x-auto", "gap-2");
    const clearanceTab = screen.getByRole("tab", { name: "Department clearance 2" });
    expect(within(clearanceTab).getByText("Clearance")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filter approvals" })).toHaveClass(
      "data-[side=right]:w-full"
    );
  });

  it("presents the API-backed approval context in separate informative columns", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T09:00:00.000Z"));
    try {
      render(<MyWorkQueuesWorkspace />);

      const table = screen.getByRole("table");
      expect(within(table).getByRole("columnheader", { name: "Request no." })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Type" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Category" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Submitted" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Last working date" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Current step" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Attachment" })).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: "Waiting time" })).toBeVisible();

      const requestRow = screen.getByRole("row", { name: "Open Payroll correction" });
      expect(within(requestRow).getByText("HR-0043")).toBeVisible();
      expect(within(requestRow).getByText("Payroll correction")).toBeVisible();
      expect(within(requestRow).getByText("HR request")).toBeVisible();
      expect(within(requestRow).getByText("Step 2")).toBeVisible();
      expect(within(requestRow).getByText("Meera Shah")).toBeVisible();
      expect(within(requestRow).getByText("1 attachment")).toBeVisible();
      expect(within(requestRow).getByText("12 days waiting")).toBeVisible();

      const separationRow = screen.getByRole("row", { name: "Open Resignation" });
      expect(within(separationRow).getByText("Separation")).toBeVisible();
      expect(within(separationRow).getByText(/30.*2026/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("orders the merged approval queue globally by oldest submission first", () => {
    render(<MyWorkQueuesWorkspace />);

    const viewActions = within(screen.getByRole("table")).getAllByRole("button", {
      name: /^View /,
    });
    expect(viewActions.map((action) => action.getAttribute("aria-label"))).toEqual([
      "View Resignation",
      "View Employment letter",
      "View Payroll correction",
    ]);
  });

  it("keeps actionable clearance ahead of historical rows", async () => {
    const user = userEvent.setup();
    mockQueues({ clearances: [clearanceItems[1], clearanceItems[0]] });
    render(<MyWorkQueuesWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Department clearance 2" }));

    const viewActions = within(screen.getByRole("table")).getAllByRole("button", {
      name: /^View /,
    });
    expect(viewActions.map((action) => action.getAttribute("aria-label"))).toEqual([
      "View Laptop Return",
      "View Final Settlement",
    ]);
  });

  it("applies local filters and keeps removable chips in sync with their controls", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    await user.type(screen.getByRole("searchbox", { name: "Search approvals" }), "Neha");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(screen.getByRole("row", { name: "Open Employment letter" })).toBeVisible();
    expect(screen.queryByRole("row", { name: "Open Payroll correction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("row", { name: "Open Resignation" })).not.toBeInTheDocument();
    expect(screen.getByText("Search: Neha")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Remove Search: Neha filter" }));

    expect(screen.getByRole("searchbox", { name: "Search approvals" })).toHaveValue("");
    expect(screen.getByRole("row", { name: "Open Payroll correction" })).toBeVisible();
    expect(screen.getByRole("row", { name: "Open Resignation" })).toBeVisible();
  });

  it("opens row details in a temporary drawer, hides absent sections, and closes it", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Employment letter" }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Employment letter" })).toBeVisible();
    expect(within(drawer).getByText("EMP-1007")).toBeVisible();
    expect(within(drawer).getByText("Operations Executive")).toBeVisible();
    expect(within(drawer).getByText("Needed for the bank")).toBeVisible();
    expect(within(drawer).queryByText("Attachment")).not.toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps View as the only interactive control in each table row", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    const approvalRow = screen.getByRole("row", { name: "Open Employment letter" });
    expect(approvalRow).not.toHaveAttribute("tabindex");
    expect(within(approvalRow).getAllByRole("button")).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: "Department clearance 2" }));
    const clearanceRow = screen.getByRole("row", { name: "Open Laptop Return" });
    expect(clearanceRow).not.toHaveAttribute("tabindex");
    expect(within(clearanceRow).getAllByRole("button")).toHaveLength(1);
  });

  it("exposes only API-permitted actions from the drawer and launches the existing dialog", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    await user.click(screen.getByRole("button", { name: "View Employment letter" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Approve" })).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("heading", { name: "Approve" })).toBeVisible();
  });

  it("closes row details when an action dialog launches", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);

    await user.click(screen.getByRole("button", { name: "View Employment letter" }));
    const drawer = screen.getByRole("dialog");
    await user.click(within(drawer).getByRole("button", { name: "Approve" }));

    expect(screen.getByRole("dialog", { name: "Approve" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Employment letter" })).not.toBeInTheDocument();
  });

  it("shows view-only clearance without disabled action buttons", async () => {
    const user = userEvent.setup();
    render(<MyWorkQueuesWorkspace />);
    await user.click(screen.getByRole("tab", { name: "Department clearance 2" }));
    await user.click(screen.getByRole("button", { name: "View Final Settlement" }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("View only")).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: "Clear item" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
  });

  it("renders filter and table skeletons while the active queue is loading", () => {
    vi.mocked(usePendingHrRequestApprovals).mockReturnValue({
      ...queryState,
      data: undefined,
      isLoading: true,
      refetch: refetchRequests,
    } as never);
    vi.mocked(usePendingSeparationApprovals).mockReturnValue({
      ...queryState,
      data: undefined,
      isLoading: true,
      refetch: refetchSeparations,
    } as never);

    render(<MyWorkQueuesWorkspace />);

    const loading = screen.getByRole("status", { name: "Loading approvals" });
    expect(loading).toHaveAttribute("aria-live", "polite");
    expect(within(loading).getByLabelText("Loading filters")).toBeVisible();
    expect(within(loading).getByLabelText("Loading table rows")).toBeVisible();
  });

  it("shows a concise error with retry for the active queue", async () => {
    const user = userEvent.setup();
    vi.mocked(usePendingHrRequestApprovals).mockReturnValue({
      ...queryState,
      data: undefined,
      error: new Error("Network failed"),
      refetch: refetchRequests,
    } as never);

    render(<MyWorkQueuesWorkspace />);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load approvals");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchRequests).toHaveBeenCalledOnce();
    expect(refetchSeparations).toHaveBeenCalledOnce();
  });

  it("distinguishes successful and filtered empty states", async () => {
    const user = userEvent.setup();
    mockQueues({ requests: [], separationRows: [], clearances: [] });
    const { rerender } = render(<MyWorkQueuesWorkspace />);

    expect(screen.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Department clearance 0" }));
    expect(
      screen.getByRole("heading", { name: "All department clearance items are complete" })
    ).toBeVisible();

    mockQueues();
    rerender(<MyWorkQueuesWorkspace />);
    await user.click(screen.getByRole("tab", { name: "Approvals 3" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search approvals" }), {
      target: { value: "does-not-exist" },
    });
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(screen.getByRole("heading", { name: "No approvals match these filters" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });
});
