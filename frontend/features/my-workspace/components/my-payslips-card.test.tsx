import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyPayslipsCard } from "./my-payslips-card";

vi.mock("@/features/payroll/hooks", () => ({
  useMyPayslips: () => ({
    data: [
      {
        id: "p1",
        payrollYear: 2026,
        payrollMonth: 8,
        runNumber: "PR-1",
        netSalary: "1000",
        currencyCode: "INR",
        status: "PENDING",
      },
      {
        id: "p2",
        payrollYear: 2026,
        payrollMonth: 7,
        runNumber: "PR-0",
        netSalary: "900",
        currencyCode: "INR",
        status: "FAILED",
      },
      {
        id: "p3",
        payrollYear: 2026,
        payrollMonth: 6,
        runNumber: "PR-old",
        netSalary: "800",
        currencyCode: "INR",
        status: "AVAILABLE",
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePayslipDownloadGrant: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({
    data: { payroll: true, payrollNav: true },
    isLoading: false,
  }),
}));

describe("MyPayslipsCard status copy", () => {
  it("shows pending, failed, and available states", () => {
    render(<MyPayslipsCard />);
    expect(
      screen.getByText(/Payslip generation is in progress/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Payslip generation failed/i)).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
  });
});
