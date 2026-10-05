import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionsWorkspace } from "./transactions-workspace";

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));

vi.mock("../hooks", () => ({
  useFinanceTransactions: () => ({
    data: { items: [] },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/tables/data-table", () => ({
  DataTable: () => <div>table</div>,
}));

vi.mock("./create-transaction-dialog", () => ({
  CreateTransactionDialog: () => null,
}));

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

describe("TransactionsWorkspace collection capability", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useModuleCapabilities).mockReset();
  });

  it("hides New transaction without CREATE_TRANSACTION", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { financeActions: [] },
    } as never);

    render(<TransactionsWorkspace />);
    expect(screen.queryByText("New transaction")).not.toBeInTheDocument();
  });

  it("shows New transaction when CREATE_TRANSACTION is present", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { financeActions: ["CREATE_TRANSACTION"] },
    } as never);

    render(<TransactionsWorkspace />);
    expect(screen.getByText("New transaction")).toBeInTheDocument();
  });

  it("names transaction search and status controls", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { financeActions: [] },
    } as never);

    render(<TransactionsWorkspace />);

    expect(screen.getByRole("textbox", { name: "Search transactions" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter transactions by status" }),
    ).toBeInTheDocument();
  });
});
