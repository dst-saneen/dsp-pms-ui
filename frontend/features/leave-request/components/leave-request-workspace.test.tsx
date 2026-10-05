import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveRequestWorkspace } from "./leave-request-workspace";

const auth = vi.hoisted(() => ({
  roles: ["REPORTING_MANAGER"],
  permissions: ["hr.team.approve"],
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { employeeId: "employee-1", authorization: { roles: auth.roles } },
    hasPermission: (permission: string) => auth.permissions.includes(permission),
  }),
}));

vi.mock("../dialogs/process-leave-request-sheet", () => ({
  ProcessLeaveRequestSheet: () => null,
}));

vi.mock("../hooks/use-leave-requests", () => ({
  useLeaveRequests: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  })),
  usePendingLeaveApprovals: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

import { usePendingLeaveApprovals } from "../hooks/use-leave-requests";

describe("LeaveRequestWorkspace", () => {
  beforeEach(() => {
    auth.roles = ["REPORTING_MANAGER"];
    auth.permissions = ["hr.team.approve"];
    vi.mocked(usePendingLeaveApprovals).mockClear();
  });

  it("uses the newly available review queue on the first render after permissions change", () => {
    const { rerender } = render(<LeaveRequestWorkspace />);
    expect(screen.getByRole("button", { name: "Manager review" })).toBeInTheDocument();

    auth.roles = ["HR_MANAGER"];
    auth.permissions = ["hr.leave.manage"];
    vi.mocked(usePendingLeaveApprovals).mockClear();
    rerender(<LeaveRequestWorkspace />);

    expect(vi.mocked(usePendingLeaveApprovals).mock.calls[0]?.[0]).toBe("hr");
    expect(screen.getByRole("button", { name: "HR review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manager review" })).not.toBeInTheDocument();
  });
});
