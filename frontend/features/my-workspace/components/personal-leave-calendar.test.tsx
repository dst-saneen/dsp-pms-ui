import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MyCalendarDay, MyLeaveBalance } from "../types";
import {
  PersonalLeaveCalendar,
  type PersonalLeaveCalendarProps,
} from "./personal-leave-calendar";

const days: MyCalendarDay[] = [
  {
    date: "2026-09-05",
    employees: [{ employeeId: "employee-1", state: "WEEK_OFF", dayType: "WEEK_OFF" }],
  },
  {
    date: "2026-09-09",
    employees: [{
      employeeId: "employee-1",
      state: "ON_LEAVE",
      dayType: "WORKING",
      portion: "FULL_DAY",
      leaveStatus: "APPROVED",
      leaveTypeName: "Annual Leave",
      leaveTypeId: "annual",
      approvalStage: "APPROVED",
    }],
  },
  {
    date: "2026-09-10",
    employees: [{ employeeId: "employee-1", state: "AVAILABLE", dayType: "WORKING" }],
  },
  {
    date: "2026-09-16",
    employees: [{
      employeeId: "employee-1",
      state: "SCHEDULED",
      dayType: "WORKING",
      shiftName: "General Shift",
    }],
  },
  {
    date: "2026-09-19",
    employees: [{
      employeeId: "employee-1",
      state: "HOLIDAY",
      dayType: "HOLIDAY",
      holidayName: "Founders Day",
      holidaySource: "BUSINESS_CALENDAR",
      holidayCalendarId: "calendar-1",
    }],
  },
  {
    date: "2026-09-23",
    employees: [{
      employeeId: "employee-1",
      state: "PENDING_LEAVE",
      dayType: "WORKING",
      leaveStatus: "SUBMITTED",
      leaveTypeName: "Sick Leave",
      leaveTypeId: "sick",
      approvalStage: "MANAGER_REVIEW",
    }],
  },
];

const balances: MyLeaveBalance[] = [{
  leaveTypeId: "annual",
  leaveCode: "AL",
  leaveName: "Annual Leave",
  entitlement: 18,
  used: 5,
  pending: 1,
  balance: 12,
}];

function props(overrides: Partial<PersonalLeaveCalendarProps> = {}): PersonalLeaveCalendarProps {
  return {
    view: "month",
    displayedDate: "2026-09-16",
    selectedDate: "2026-09-16",
    businessDate: "2026-09-16",
    timezone: "Asia/Kolkata",
    onViewChange: vi.fn(),
    onDisplayedDateChange: vi.fn(),
    onSelectedDateChange: vi.fn(),
    days,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    onRetry: vi.fn(),
    balances,
    holidayDays: days,
    holidaysLoading: false,
    holidaysError: null,
    holidaysFetching: false,
    onRetryHolidays: vi.fn(),
    leaveData: {
      summary: { totalEntitlement: 18, totalUsed: 5, totalPending: 1, totalBalance: 12 },
      balances,
      history: [{
        id: "request-1",
        leaveType: "Annual Leave",
        fromDate: "2026-10-01",
        toDate: "2026-10-02",
        requestedDays: 2,
        status: "SUBMITTED",
        createdAt: "2026-09-01T00:00:00.000Z",
      }],
      upcoming: [{
        id: "request-1",
        leaveType: "Annual Leave",
        fromDate: "2026-10-01",
        toDate: "2026-10-02",
        approvedDays: 2,
        status: "APPROVED",
      }],
    },
    leaveLoading: false,
    leaveError: null,
    leaveFetching: false,
    onRetryLeave: vi.fn(),
    canApplyLeave: true,
    onApplyLeave: vi.fn(),
    onOpenMyLeave: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe("PersonalLeaveCalendar", () => {
  it("uses exactly Month, Week, Holiday List, and Leave navigation", () => {
    render(<PersonalLeaveCalendar {...props()} />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Month",
      "Week",
      "Holiday List",
      "Leave",
    ]);
    expect(screen.queryByRole("tab", { name: "List" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Balances" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Holidays" })).not.toBeInTheDocument();
  });

  it("renders a selected branch-business date, without marking ordinary dates Available", () => {
    render(<PersonalLeaveCalendar {...props()} />);

    const today = screen.getByRole("gridcell", { name: /16 today general shift/i });
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.queryByText(/normal day/i)).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Calendar September 2026" }).querySelectorAll("[role=gridcell]")).toHaveLength(42);
  });

  it("uses the native date control to navigate and select immediately", () => {
    const onDisplayedDateChange = vi.fn();
    const onSelectedDateChange = vi.fn();
    render(<PersonalLeaveCalendar {...props({ onDisplayedDateChange, onSelectedDateChange })} />);

    const input = screen.getByLabelText("Go to date");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveValue("2026-09-16");
    fireEvent.change(input, { target: { value: "2026-09-23" } });

    expect(onDisplayedDateChange).toHaveBeenCalledWith("2026-09-23");
    expect(onSelectedDateChange).toHaveBeenCalledWith("2026-09-23");
  });

  it("uses a Sunday-start Week grid and navigates it in exact seven-day steps", async () => {
    const onViewChange = vi.fn();
    const onDisplayedDateChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<PersonalLeaveCalendar {...props({ onViewChange, onDisplayedDateChange })} />);

    await user.click(screen.getByRole("tab", { name: "Week" }));
    expect(onViewChange).toHaveBeenCalledWith("week");
    rerender(<PersonalLeaveCalendar {...props({ view: "week", onDisplayedDateChange })} />);

    expect(screen.getByRole("grid", { name: "Week of Sun, 13 Sept, 2026" })).toBeVisible();
    const selected = screen.getByRole("gridcell", { name: /16 today general shift/i });
    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowLeft" });
    expect(screen.getByRole("gridcell", { name: "15" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(onDisplayedDateChange).toHaveBeenCalledWith("2026-09-23");
  });

  it("keeps the Week planner on internal dividers instead of an enclosing card border", () => {
    render(<PersonalLeaveCalendar {...props({ view: "week" })} />);

    const grid = screen.getByRole("grid", { name: "Week of Sun, 13 Sept, 2026" });
    expect(grid).not.toHaveClass("border", "rounded-lg");
    expect(screen.getByRole("gridcell", { name: "13" })).toHaveClass("border-r");
    expect(screen.getByRole("gridcell", { name: /16 today general shift/i })).not.toHaveClass(
      "ring-2",
      "ring-primary"
    );
  });

  it("gives approved leave a different Week color than Present", () => {
    render(
      <PersonalLeaveCalendar
        {...props({
          view: "week",
          displayedDate: "2026-09-09",
          selectedDate: "2026-09-09",
          businessDate: "2026-09-09",
        })}
      />
    );

    const approvedLeave = screen.getByRole("gridcell", {
      name: /9 today annual leave.*approved.*full day/i,
    });
    expect(approvedLeave).toHaveClass("bg-violet-50");
    expect(approvedLeave).not.toHaveClass("bg-emerald-50");
  });

  it("keeps Today distinct from event legend colors without a selected-outline key", () => {
    render(<PersonalLeaveCalendar {...props()} />);

    const legend = screen.getByLabelText("Calendar legend");
    expect(within(legend).getByText("Approved leave").querySelector("[aria-hidden=true]")).toHaveClass(
      "bg-violet-500"
    );
    expect(within(legend).getByText("Today").querySelector("[aria-hidden=true]")).toHaveClass("bg-amber-500");
    expect(within(legend).queryByText("Selected outline")).not.toBeInTheDocument();
  });

  it("keeps selected-date details concise when API data has no record", () => {
    render(<PersonalLeaveCalendar {...props({ selectedDate: "2026-09-18" })} />);
    const details = screen.getByRole("complementary", { name: "Day details" });
    expect(within(details).getByText("No published details for this date.")).toBeVisible();
    expect(within(details).queryByText("No holiday")).not.toBeInTheDocument();
    expect(within(details).queryByText("No leave")).not.toBeInTheDocument();
  });

  it("lists only genuine holiday records and allows its year to change", () => {
    const onDisplayedDateChange = vi.fn();
    const { rerender } = render(<PersonalLeaveCalendar {...props({ onDisplayedDateChange })} />);
    fireEvent.click(screen.getByRole("tab", { name: "Holiday List" }));
    rerender(<PersonalLeaveCalendar {...props({ view: "holiday-list", onDisplayedDateChange })} />);

    expect(screen.getByRole("table", { name: "Published holidays for 2026" })).toBeVisible();
    expect(screen.getByText("Founders Day")).toBeVisible();
    expect(screen.queryByText("Annual Leave")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Holiday year"), { target: { value: "2027" } });
    expect(onDisplayedDateChange).toHaveBeenCalledWith("2027-01-01");
  });

  it("keeps Calendar Leave compact with upcoming requests and a My leave action", () => {
    const onOpenMyLeave = vi.fn();
    render(<PersonalLeaveCalendar {...props({ view: "leave", onOpenMyLeave })} />);

    expect(screen.getByRole("heading", { name: "Upcoming leave" })).toBeVisible();
    expect(screen.getByText("Annual Leave")).toBeVisible();
    expect(screen.getByText("Submitted")).toBeVisible();
    expect(screen.queryByText("Available leave")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Leave balances by type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Leave requests" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open My leave" }));
    expect(onOpenMyLeave).toHaveBeenCalledOnce();
  });

  it("shows only the first five future submitted or approved requests", () => {
    const leaveData = props().leaveData!;
    render(<PersonalLeaveCalendar {...props({
      view: "leave",
      leaveData: {
        ...leaveData,
        history: [
          { id: "rejected", leaveType: "Rejected Leave", fromDate: "2026-09-20", toDate: "2026-09-20", requestedDays: 1, status: "REJECTED", createdAt: "2026-09-01" },
          { id: "past", leaveType: "Past Leave", fromDate: "2026-09-01", toDate: "2026-09-02", requestedDays: 2, status: "APPROVED", createdAt: "2026-08-01" },
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `future-${index}`,
            leaveType: `Future Leave ${index + 1}`,
            fromDate: `2026-10-0${index + 1}`,
            toDate: `2026-10-0${index + 1}`,
            requestedDays: 1,
            status: index % 2 === 0 ? "SUBMITTED" : "APPROVED",
            createdAt: "2026-09-01",
          })),
        ],
      },
    })} />);

    expect(screen.queryByText("Rejected Leave")).not.toBeInTheDocument();
    expect(screen.queryByText("Past Leave")).not.toBeInTheDocument();
    expect(screen.getByText("Future Leave 1")).toBeVisible();
    expect(screen.getByText("Future Leave 5")).toBeVisible();
    expect(screen.queryByText("Future Leave 6")).not.toBeInTheDocument();
  });

  it("prefills Apply leave from the selected date only when it is permitted", () => {
    const onApplyLeave = vi.fn();
    render(<PersonalLeaveCalendar {...props({ selectedDate: "2026-09-09", onApplyLeave })} />);

    fireEvent.click(screen.getByRole("button", { name: /Apply leave for this date/i }));
    expect(onApplyLeave).toHaveBeenCalledWith({ fromDate: "2026-09-09" });
  });
});
