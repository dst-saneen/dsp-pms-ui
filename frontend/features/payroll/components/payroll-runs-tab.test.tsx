import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayrollRunsTab } from "./payroll-runs-tab";

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));

vi.mock("../hooks", () => ({
  usePayrollRuns: vi.fn(),
}));

vi.mock("./create-run-dialog", () => ({
  CreateRunDialog: () => null,
}));

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { usePayrollRuns } from "../hooks";

const run = (index: number) => ({
  id: `run-${index}`,
  version: 1,
  runNumber: `PR-${index}`,
  year: 2026,
  month: 8,
  status: "PAID",
  currencyCode: "INR",
  totals: { earnings: "1000", deductions: "0", net: "1000" },
  blockers: [],
  warnings: [],
  financeTransactionId: null,
  allowedActions: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

describe("PayrollRunsTab collection capability", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useModuleCapabilities).mockReset();
    vi.mocked(usePayrollRuns).mockReset();
    vi.mocked(usePayrollRuns).mockReturnValue({
      data: { items: [], total: 0, page: 1, limit: 10 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("disables New run without CREATE_RUN", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payrollActions: [] },
    } as never);

    render(<PayrollRunsTab />);
    expect(screen.getByRole("button", { name: /new run/i })).toBeDisabled();
  });

  it("shows New run when CREATE_RUN is present", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payrollActions: ["CREATE_RUN"] },
    } as never);

    render(<PayrollRunsTab />);
    const newRunButtons = screen.getAllByRole("button", {
      name: /new run/i,
    });

    // The toolbar and empty-state action row are separate visible entry points.
    expect(newRunButtons).toHaveLength(2);
    newRunButtons.forEach((button) => expect(button).toBeEnabled());
  });

  it("fetches the next API page so runs beyond the first page remain reachable", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payrollActions: [] },
    } as never);
    vi.mocked(usePayrollRuns).mockImplementation((filters) => ({
      data: {
        items: filters?.page === 2 ? [run(11)] : Array.from({ length: 10 }, (_, index) => run(index + 1)),
        total: 11,
        page: filters?.page ?? 1,
        limit: filters?.limit ?? 10,
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }) as never);

    render(<PayrollRunsTab />);
    expect(screen.getByText("PR-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    expect(usePayrollRuns).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
    expect(screen.getByText("PR-11")).toBeInTheDocument();
  });

  it.each(["loading", "error"])(
    "keeps the pager available when the next API page is %s",
    (state) => {
      vi.mocked(useModuleCapabilities).mockReturnValue({
        data: { payrollActions: [] },
      } as never);
      vi.mocked(usePayrollRuns).mockImplementation((filters) =>
        (filters?.page === 2
          ? {
              data: undefined,
              isLoading: state === "loading",
              isFetching: state === "loading",
              error: state === "error" ? new Error("page unavailable") : null,
              refetch: vi.fn(),
            }
          : {
              data: {
                items: Array.from({ length: 10 }, (_, index) => run(index + 1)),
                total: 11,
                page: 1,
                limit: 10,
              },
              isLoading: false,
              isFetching: false,
              error: null,
              refetch: vi.fn(),
            }) as never
      );

      render(<PayrollRunsTab />);
      const next = screen.getByRole("button", { name: "Next page" });
      next.focus();
      fireEvent.click(next);

      expect(next).toBeInTheDocument();
      const previous = screen.getByRole("button", { name: "Previous page" });
      expect(previous).toBeEnabled();
      fireEvent.click(previous);
      expect(screen.getByText("PR-1")).toBeInTheDocument();
    }
  );

  it("shows page-specific guidance when an older page becomes empty", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { payrollActions: [] },
    } as never);
    vi.mocked(usePayrollRuns).mockImplementation((filters) => ({
      data:
        filters?.page === 2
          ? { items: [], total: 10, page: 2, limit: 10 }
          : {
              items: Array.from({ length: 10 }, (_, index) => run(index + 1)),
              total: 11,
              page: 1,
              limit: 10,
            },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }) as never);

    render(<PayrollRunsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("No runs on this page")).toBeInTheDocument();
    expect(screen.getByText("Page 2 is no longer available · 10 total")).toBeInTheDocument();
    expect(screen.queryByText("Page 2 of 1 · 10 total")).not.toBeInTheDocument();
    expect(screen.queryByText("No payroll runs")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });
});
