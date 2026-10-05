import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthCalendar, type CalendarDayTone } from "./month-calendar";

const toneCases: Array<{
  tone: CalendarDayTone;
  expectedSurface: string;
  expectedMarker: string;
}> = [
  { tone: "scheduled", expectedSurface: "bg-sky-50", expectedMarker: "bg-sky-500" },
  { tone: "present", expectedSurface: "bg-emerald-50", expectedMarker: "bg-emerald-500" },
  { tone: "leave", expectedSurface: "bg-violet-50", expectedMarker: "bg-violet-500" },
  { tone: "pending", expectedSurface: "bg-amber-50", expectedMarker: "bg-amber-500" },
  { tone: "holiday", expectedSurface: "bg-purple-50", expectedMarker: "bg-purple-500" },
  { tone: "weekOff", expectedSurface: "bg-slate-50", expectedMarker: "bg-slate-500" },
  { tone: "halfDay", expectedSurface: "bg-cyan-50", expectedMarker: "bg-cyan-500" },
  { tone: "absent", expectedSurface: "bg-rose-50", expectedMarker: "bg-rose-500" },
  { tone: "unscheduled", expectedSurface: "bg-orange-50", expectedMarker: "bg-orange-500" },
];

afterEach(() => {
  cleanup();
});

describe("MonthCalendar", () => {
  it.each(toneCases)(
    "renders $tone with its semantic filled surface and marker",
    ({ tone, expectedSurface, expectedMarker }) => {
      render(
        <MonthCalendar
          year={2026}
          monthIndex={8}
          days={[
            {
              date: "2026-09-16",
              label: "Calendar event",
              tone,
            },
          ]}
        />
      );

      const cell = screen.getByRole("gridcell", {
        name: /16 calendar event/i,
      });
      expect(cell).toHaveClass(expectedSurface);
      expect(cell.querySelector(`[data-event-marker="${tone}"]`)).toHaveClass(expectedMarker);
    }
  );

  it("keeps an event's color when the same date is today and selected", () => {
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        todayDate="2026-09-16"
        selectedDate="2026-09-16"
        days={[
          {
            date: "2026-09-16",
            label: "Annual leave",
            tone: "leave",
          },
        ]}
      />
    );

    const cell = screen.getByRole("gridcell", {
      name: /16 today annual leave/i,
    });
    expect(cell).toHaveClass("bg-violet-50", "ring-2", "ring-primary");
    expect(cell).toHaveAttribute("aria-current", "date");
    expect(cell).toHaveAttribute("aria-selected", "true");
  });

  it("keeps ordinary scheduled days quiet while retaining a blue marker", () => {
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        days={[
          {
            date: "2026-09-16",
            label: "General Shift",
            tone: "scheduled",
            emphasis: "marker",
          },
        ]}
      />
    );

    const cell = screen.getByRole("gridcell", {
      name: /16 general shift/i,
    });
    expect(cell).toHaveClass("bg-card", "border-border");
    expect(cell).not.toHaveClass("bg-sky-50");
    expect(cell.querySelector('[data-event-marker="scheduled"]')).toHaveClass("bg-sky-500");
  });

  it("uses internal dividers without an enclosing frame in the personal planner", () => {
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        variant="personal"
        onSelectDate={vi.fn()}
      />
    );

    const grid = screen.getByRole("grid", { name: "Calendar September 2026" });
    expect(grid).not.toHaveClass("border", "rounded-b-lg");
    expect(screen.getByRole("gridcell", { name: "16" })).toHaveClass("border-r", "border-b");
  });

  it("keeps a personal-calendar selection semantic without a persistent outline", () => {
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        variant="personal"
        selectedDate="2026-09-16"
      />
    );

    const selected = screen.getByRole("gridcell", { name: "16" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).not.toHaveClass("ring-2", "ring-primary");
  });

  it("keeps event text visible on mobile by default and compacts it only when requested", () => {
    const calendar = (
      <MonthCalendar
        year={2026}
        monthIndex={8}
        days={[
          {
            date: "2026-09-16",
            label: "General Shift",
            secondary: "09:00 – 18:00",
            tone: "scheduled",
          },
        ]}
      />
    );
    const { rerender } = render(calendar);

    expect(screen.getByText("General Shift")).not.toHaveClass("max-sm:sr-only");
    expect(screen.getByText("09:00 – 18:00")).not.toHaveClass("max-sm:sr-only");

    rerender(<MonthCalendar {...calendar.props} compactMobile />);
    expect(screen.getByText("General Shift")).toHaveClass("max-sm:sr-only");
    expect(screen.getByText("09:00 – 18:00")).toHaveClass("max-sm:sr-only");
  });

  it("keeps outside-month dates muted without event markers", () => {
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        todayDate="2026-08-31"
        selectedDate="2026-08-31"
        days={[
          {
            date: "2026-08-31",
            label: "Adjacent holiday",
            tone: "holiday",
          },
        ]}
      />
    );

    const outsideDate = screen.getByRole("gridcell", { name: "31" });
    expect(outsideDate).toHaveClass("bg-muted/40", "border-transparent");
    expect(outsideDate).not.toHaveClass("ring-2", "ring-primary");
    expect(outsideDate).not.toHaveAttribute("aria-current");
    expect(outsideDate.querySelector("[data-event-marker]")).toBeNull();
  });

  it("moves focus between calendar dates with arrow keys", () => {
    const onSelectDate = vi.fn();
    render(
      <MonthCalendar
        year={2026}
        monthIndex={8}
        selectedDate="2026-09-16"
        onSelectDate={onSelectDate}
      />
    );

    const selected = screen.getByRole("gridcell", { name: "16" });
    const next = screen.getByRole("gridcell", { name: "17" });
    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(next).toHaveFocus();

    fireEvent.click(next);
    expect(onSelectDate).toHaveBeenCalledWith("2026-09-17");
  });
});
