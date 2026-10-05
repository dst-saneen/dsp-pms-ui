import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateTransactionDialog } from "./create-transaction-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: () => ({ data: [], isLoading: false }) };
});

vi.mock("@/components/common/form-sheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/lookups/hooks/use-departments", () => ({
  useDepartments: () => ({ data: [] }),
}));

vi.mock("@/features/projects/hooks/use-projects", () => ({
  useProjectsList: () => ({ data: { items: [] } }),
}));

vi.mock("../hooks", () => ({
  useCreateFinanceTransaction: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useFinanceCategories: () => ({ data: { items: [] } }),
  useFinancePaymentAccounts: () => ({ data: { items: [] } }),
  useBusinessParties: () => ({ data: { items: [] } }),
}));

describe("CreateTransactionDialog accessibility", () => {
  afterEach(cleanup);

  it("associates visible transaction labels with their controls", () => {
    render(<CreateTransactionDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Type (required)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category (required)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Source account (required)" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Customer / vendor (optional)" })
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Department (optional)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project (optional)" })).toBeInTheDocument();
  });
});
