import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagerDashboard } from "./manager-dashboard";
import type { ManagerDashboardPayload } from "./types";

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({ data: undefined }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ hasPermission: () => false }),
}));

const financeOnlyPayload: ManagerDashboardPayload = {
  source: "live",
  data: {
    manager: { fullName: "QA India Finance Maker", role: "FINANCE_MAKER" },
    visibility: {
      employeeSummary: false,
      attendance: false,
      leave: false,
      onboarding: false,
    },
    metricsWidget: { status: "ok", retryable: false },
    metrics: [
      {
        key: "total-employees",
        label: "Total Employees",
        value: 2,
        tone: "coral",
        href: "/hr/employees",
      },
      {
        key: "present-today",
        label: "Present Today",
        value: 1,
        tone: "teal",
        href: "/hr/attendance",
      },
    ],
    tasks: { status: "empty", items: [], retryable: false },
    interviews: [],
    pendingLeaveApprovals: { status: "empty", items: [], retryable: false },
    pendingTimesheetApprovals: { status: "empty", items: [], retryable: false },
    attendance: { status: "empty", items: [], retryable: false },
    recentJoiners: { status: "empty", items: [], retryable: false },
  },
};

describe("ManagerDashboard permission boundaries", () => {
  afterEach(cleanup);

  it("does not render HR metrics or destinations for a finance-only session", () => {
    render(<ManagerDashboard payload={financeOnlyPayload} now={new Date("2026-09-21")} />);

    expect(screen.queryByRole("link", { name: /Total Employees/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Present Today/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/HR operations overview/i)).not.toBeInTheDocument();
    expect(screen.getByText(/permitted work is available in the navigation/i)).toBeInTheDocument();
  });
});
