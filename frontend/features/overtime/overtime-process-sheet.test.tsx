import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OvertimeProcessSheet } from "./overtime-process-sheet";

vi.mock("@/components/common/form-sheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock("./hooks", () => ({
  useApproveOvertime: vi.fn(),
  useCancelOvertime: vi.fn(),
  useRejectOvertime: vi.fn(),
}));

import { useApproveOvertime, useCancelOvertime, useRejectOvertime } from "./hooks";

describe("OvertimeProcessSheet", () => {
  beforeEach(() => {
    const mutation = { isPending: false, mutateAsync: vi.fn() };
    vi.mocked(useApproveOvertime).mockReturnValue(mutation as never);
    vi.mocked(useCancelOvertime).mockReturnValue(mutation as never);
    vi.mocked(useRejectOvertime).mockReturnValue(mutation as never);
  });

  it("does not block a Company policy that allows comp-off below 240 minutes", () => {
    render(
      <OvertimeProcessSheet
        open
        onOpenChange={vi.fn()}
        mode="approve"
        request={{
          id: "overtime-1",
          employeeId: "employee-1",
          branchId: "branch-1",
          businessDate: "2026-09-18",
          rawMinutes: 120,
          eligibleMinutes: 120,
          requestedMinutes: 120,
          status: "SUBMITTED",
        }}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Comp-off credit (policy validated)",
      })
    ).toBeEnabled();
    expect(screen.getByText(/Company or Branch overtime policy/)).toBeInTheDocument();
  });
});
