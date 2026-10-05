import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmployeeLeaveBalanceWorkspace } from "./employee-leave-balance-workspace";

vi.mock("@/components/forms", () => ({
  LookupSelect: ({
    id,
    placeholder,
  }: {
    id?: string;
    placeholder?: string;
  }) => (
    <button id={id} type="button">
      {placeholder}
    </button>
  ),
}));

vi.mock("@/features/lookups/hooks/use-branches", () => ({
  useBranches: vi.fn(),
}));

vi.mock("@/features/lookups/hooks/use-companies", () => ({
  useCompanies: vi.fn(),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { authorization: { activeCompanyId: "company-1" } },
    hasPermission: () => false,
  }),
}));

vi.mock("../dialogs/generate-leave-balances-sheet", () => ({
  GenerateLeaveBalancesSheet: () => null,
}));

vi.mock("../hooks/use-employee-leave-balances", () => ({
  useEmployeeLeaveBalances: vi.fn(),
}));

import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";

import { useEmployeeLeaveBalances } from "../hooks/use-employee-leave-balances";

describe("EmployeeLeaveBalanceWorkspace", () => {
  beforeEach(() => {
    vi.mocked(useCompanies).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useBranches).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useEmployeeLeaveBalances).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("associates the visible year label with its numeric filter", () => {
    render(<EmployeeLeaveBalanceWorkspace />);

    expect(screen.getByLabelText("Year")).toHaveAttribute("type", "number");
  });

  it("gives the company, branch, and search filters accessible names", () => {
    render(<EmployeeLeaveBalanceWorkspace />);

    expect(screen.getByLabelText("Company")).toHaveRole("button");
    expect(screen.getByLabelText("Branch")).toHaveRole("button");
    expect(screen.getByLabelText("Search employees")).toHaveAttribute(
      "placeholder",
      "Search employee…",
    );
  });
});
