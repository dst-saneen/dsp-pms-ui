import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayrollWorkspace } from "./payroll-workspace";

vi.mock("./payroll-runs-tab", () => ({
  PayrollRunsTab: () => <div>runs</div>,
}));
vi.mock("./salary-components-tab", () => ({
  SalaryComponentsTab: () => <div>components</div>,
}));
vi.mock("./employee-salaries-tab", () => ({
  EmployeeSalariesTab: () => <div>salaries</div>,
}));
vi.mock("./tax-profiles-tab", () => ({
  TaxProfilesTab: () => <div>tax</div>,
}));
vi.mock("./recurring-deductions-tab", () => ({
  RecurringDeductionsTab: () => <div>deductions</div>,
}));
vi.mock("./payroll-reports-tab", () => ({
  PayrollReportsTab: () => <div>reports</div>,
}));
vi.mock("./payslip-operations-tab", () => ({
  PayslipOperationsTab: () => <div>payslip operations</div>,
}));
vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

describe("PayrollWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useModuleCapabilities).mockReset();
  });

  it("exposes tax profile and recurring deduction tabs", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payroll: true },
    } as never);

    render(<PayrollWorkspace />);
    expect(screen.getByText("Tax Profiles")).toBeInTheDocument();
    expect(screen.getByText("Recurring Deductions")).toBeInTheDocument();
  });

  it("always shows Payslip Operations when payroll is enabled", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payroll: true, payrollActions: [] },
    } as never);

    render(<PayrollWorkspace />);
    expect(screen.getByText("Payslip Operations")).toBeInTheDocument();
  });
});
