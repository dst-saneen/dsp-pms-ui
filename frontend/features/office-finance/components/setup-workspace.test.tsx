import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetupWorkspace } from "./setup-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../hooks", () => ({
  useFinanceSettings: () => ({
    data: {
      profile: {
        version: 1,
        baseCurrencyCode: "USD",
        reportingStartDate: "2026-01-01",
        payrollExpenseCategoryId: null,
      },
    },
    isLoading: false,
  }),
  useFinanceCategories: () => ({ data: { items: [] } }),
  useUpdateFinancialProfile: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { useAuth } from "@/providers/auth-provider";

describe("SetupWorkspace finance capability", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useModuleCapabilities).mockReset();
    vi.mocked(useAuth).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      hasPermission: (permission: string) => permission === "finance.settings.manage",
    } as never);
  });

  it("uses financeActions to enable setup management", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { financeActions: ["MANAGE_SETUP"] },
    } as never);

    render(<SetupWorkspace />);

    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: "Payroll expense category (optional — leave None)" })
    ).toBeInTheDocument();
  });

  it("keeps setup read-only without MANAGE_SETUP", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { financeActions: [] },
    } as never);

    render(<SetupWorkspace />);

    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  });
});
