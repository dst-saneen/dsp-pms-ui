import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerateLeaveBalancesSheet } from "./generate-leave-balances-sheet";

vi.mock("@/components/common/form-sheet", () => ({
  FormSheet: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock("@/components/forms", () => ({
  LookupSelect: ({ id }: { id?: string }) => (
    <button id={id} type="button">
      Select
    </button>
  ),
  RequiredLabel: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/features/lookups/hooks/use-lookups", () => ({
  useBranches: vi.fn(),
  useCompanies: vi.fn(),
}));

vi.mock("../hooks/use-generate-leave-balances", () => ({
  useGenerateLeaveBalances: vi.fn(),
}));

import {
  useBranches,
  useCompanies,
} from "@/features/lookups/hooks/use-lookups";

import { useGenerateLeaveBalances } from "../hooks/use-generate-leave-balances";

describe("GenerateLeaveBalancesSheet", () => {
  beforeEach(() => {
    vi.mocked(useCompanies).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useBranches).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useGenerateLeaveBalances).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it("associates every generation filter with a stable label", () => {
    render(<GenerateLeaveBalancesSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/Year/)).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Company (optional)")).toHaveRole("button");
    expect(screen.getByLabelText("Branch (optional)")).toHaveRole("button");
  });
});
