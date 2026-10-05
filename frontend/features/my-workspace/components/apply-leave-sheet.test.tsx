import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplyLeaveSheet } from "./apply-leave-sheet";

const mutations = vi.hoisted(() => ({
  create: vi.fn(),
  preview: vi.fn(),
}));

vi.mock("@/components/common/form-sheet", () => ({
  FormSheet: ({ title, description, children, footer }: {
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
  }) => <section aria-label={title}><p>{description}</p>{children}{footer}</section>,
}));

vi.mock("@/features/my-workspace/hooks/use-my-workspace", () => ({
  useLeaveTypes: () => ({
    data: [{
      id: "annual",
      leaveCode: "ANL",
      leaveName: "Annual Leave",
      category: "ANNUAL",
      allowHalfDay: true,
      isActive: true,
    }],
    isLoading: false,
  }),
  useMyCompOff: () => ({ data: [], isLoading: false }),
  usePreviewMyLeaveRequest: () => ({ mutateAsync: mutations.preview, isPending: false }),
  useCreateMyLeaveRequest: () => ({ mutateAsync: mutations.create, isPending: false, error: null }),
}));

beforeEach(() => {
  mutations.preview.mockReset().mockResolvedValue({
    requestedWorkingDays: 1,
    fromCalendarDate: "2026-09-25",
    toCalendarDate: "2026-09-25",
    timezone: "Asia/Kolkata",
    excludedHolidays: [],
    excludedNonWorkingDays: [],
    isHalfDay: false,
    balance: {
      year: 2026,
      leaveTypeId: "annual",
      leaveName: "Annual Leave",
      entitlement: 12,
      used: 0,
      pending: 0,
      available: 12,
      afterSubmit: { available: 11, pending: 1, used: 0 },
    },
    canSubmit: true,
    blockReason: null,
    setupLinks: { myCalendar: "/my-workspace/calendar", leaveBalancesTab: "/my-workspace/leave" },
  });
  mutations.create.mockReset().mockResolvedValue({ requestedDays: 1 });
});

afterEach(cleanup);

describe("ApplyLeaveSheet", () => {
  it("keeps the employee application workflow free of HR administration links", () => {
    render(<ApplyLeaveSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("region", { name: "Apply leave" })).toBeVisible();
    expect(screen.getByLabelText("Leave type")).toBeVisible();
    expect(screen.getByLabelText("From")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("To")).toHaveAttribute("type", "date");
    expect(screen.getByRole("button", { name: "Review request" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Types" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Policies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Generate balances" })).not.toBeInTheDocument();
  });

  it("selects leave dates through native date controls", () => {
    render(
      <ApplyLeaveSheet
        open
        onOpenChange={vi.fn()}
        defaultFromDate="2026-09-16"
      />
    );

    const fromDate = screen.getByLabelText("From");
    expect(fromDate).toHaveValue("2026-09-16");
    fireEvent.change(fromDate, { target: { value: "2026-09-23" } });

    expect(fromDate).toHaveValue("2026-09-23");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-16");
  });

  it("reviews entered details before submitting directly for approval", async () => {
    render(<ApplyLeaveSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Choose details, preview impact, and submit your request.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Leave details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Request note (optional)" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Submission mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Save as draft" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Request note (optional)").tagName).toBe("TEXTAREA");

    fireEvent.change(screen.getByLabelText("Leave type"), { target: { value: "annual" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-25" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-25" } });
    expect(screen.getByRole("radio", { name: "Full day" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Half day" })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: "First half" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Second half" })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Review request" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));

    expect(screen.getByRole("heading", { name: "Preview & submit" })).toBeVisible();
    expect(screen.getByText("Annual Leave (ANL)")).toBeVisible();
    expect(screen.getByText("11 days")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(mutations.create).toHaveBeenCalledWith({
      leaveTypeId: "annual",
      fromDate: "2026-09-25",
      toDate: "2026-09-25",
      isHalfDay: false,
      reason: undefined,
      submitNow: true,
    }));
  });
});
