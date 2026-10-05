import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayrollRunDetail } from "./payroll-run-detail";
import type { PayrollRun } from "../types";

vi.mock("../hooks", () => ({
  usePayrollRun: vi.fn(),
  usePayrollRunEmployees: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  usePayrollRunHistory: () => ({ data: [], refetch: vi.fn() }),
  usePayrollRunEmployee: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useCreatePayrollAdjustment: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("./run-action-dialog", () => ({ RunActionDialog: () => null }));

import { usePayrollRun } from "../hooks";

const importedRun: PayrollRun = {
  id: "run-imported",
  version: 1,
  runNumber: "PR-OLD",
  year: 2024,
  month: 1,
  status: "LEGACY_IMPORTED",
  currencyCode: "INR",
  totals: { earnings: "1000", deductions: "100", net: "900" },
  blockers: [],
  warnings: [],
  financeTransactionId: null,
  allowedActions: ["DOWNLOAD_REGISTER"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("PayrollRunDetail imported run", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(usePayrollRun).mockReset();
  });

  it("shows an imported read-only record with register access but no lifecycle controls", () => {
    vi.mocked(usePayrollRun).mockReturnValue({
      data: importedRun,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<PayrollRunDetail runId={importedRun.id} />);

    expect(screen.getByText(/imported historical payroll run/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download register" })).toBeEnabled();
    expect(screen.getByText("No employee snapshots in this imported run")).toBeInTheDocument();
    expect(screen.getByText("This historical record has no employee rows to display.")).toBeInTheDocument();
    expect(screen.queryByText("Calculate the run to populate employee snapshots.")).not.toBeInTheDocument();
    for (const name of ["Calculate", "Return to draft", "Approve", "Mark paid", "Cancel"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Typical order:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\. Calculate → Approve → Mark paid/i)).not.toBeInTheDocument();
  });

  it("keeps the standard lifecycle guidance and actions for a draft run", () => {
    vi.mocked(usePayrollRun).mockReturnValue({
      data: { ...importedRun, status: "DRAFT", allowedActions: ["CALCULATE"] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<PayrollRunDetail runId={importedRun.id} />);

    expect(screen.getByText(/Typical order:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate" })).toBeEnabled();
  });
});
