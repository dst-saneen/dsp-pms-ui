import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OptionalHolidaySelectionCard } from "./optional-holiday-selection-card";
import type { OptionalHolidayCatalog } from "./types";

afterEach(() => {
  cleanup();
});

vi.mock("./hooks", () => ({
  useOptionalHolidays: () => ({
    data: undefined,
    isLoading: false,
    error: null,
  }),
  useUpdateOptionalHolidaySelections: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

function catalogFixture(overrides?: Partial<OptionalHolidayCatalog>): OptionalHolidayCatalog {
  return {
    year: 2027,
    timezone: "Asia/Kolkata",
    maximumHolidayDays: 10,
    mandatoryWorkingDayCount: 5,
    optionalAllowance: 5,
    selectedCount: 2,
    remainingCount: 3,
    holidays: [
      {
        eventId: "ev-1",
        date: "2027-02-01",
        name: "Floating A",
        calendarScope: "COMPANY",
        selected: true,
        selectionStatus: "APPROVED",
        locked: false,
        editableUntil: "2027-01-31T23:59:59",
      },
      {
        eventId: "ev-2",
        date: "2027-02-02",
        name: "Floating B",
        calendarScope: "COMPANY",
        selected: false,
        selectionStatus: "NONE",
        locked: false,
        editableUntil: "2027-02-01T23:59:59",
      },
      {
        eventId: "ev-3",
        date: "2027-02-03",
        name: "Floating C locked",
        calendarScope: "BRANCH",
        selected: true,
        selectionStatus: "APPROVED",
        locked: true,
        editableUntil: "2027-02-02T23:59:59",
      },
    ],
    ...overrides,
  };
}

describe("OptionalHolidaySelectionCard", () => {
  it("renders annual summary copy", () => {
    render(<OptionalHolidaySelectionCard catalog={catalogFixture()} onSave={vi.fn()} />);

    expect(screen.getByText("Maximum 10")).toBeInTheDocument();
    expect(screen.getByText("Mandatory 5")).toBeInTheDocument();
    expect(screen.getByText("You can choose 5")).toBeInTheDocument();
    expect(screen.getByText("Remaining 3")).toBeInTheDocument();
  });

  it("lets the employee select several dates then saves the full desired set", async () => {
    const onSave = vi.fn().mockResolvedValue(catalogFixture({ selectedCount: 2 }));
    render(<OptionalHolidaySelectionCard catalog={catalogFixture()} onSave={onSave} />);

    fireEvent.click(screen.getByTestId("oh-checkbox-ev-2"));
    fireEvent.click(screen.getByRole("button", { name: /Save selections/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.arrayContaining(["ev-1", "ev-2", "ev-3"]));
    });
    expect(onSave.mock.calls[0][0]).toHaveLength(3);
  });

  it("disables locked dates and shows cutoff copy", () => {
    render(<OptionalHolidaySelectionCard catalog={catalogFixture()} onSave={vi.fn()} />);

    const locked = screen.getByTestId("oh-checkbox-ev-3") as HTMLInputElement;
    expect(locked).toBeDisabled();
    expect(locked).toBeChecked();
    expect(
      screen.getByText(/Locked \(editable until 02-02-2027\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /You can change picks until the end of the previous day \(same-day is blocked\)/,
      ),
    ).toBeInTheDocument();
  });

  it("labels submitted selected holidays as pending approval", () => {
    const catalog = catalogFixture();
    render(
      <OptionalHolidaySelectionCard
        catalog={{
          ...catalog,
          holidays: [
            {
              ...catalog.holidays[0],
              selectionStatus: "SUBMITTED",
            },
          ],
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Pending approval/)).toBeInTheDocument();
  });

  it("supports swapping an unlocked selected date", async () => {
    const onSave = vi.fn().mockResolvedValue(catalogFixture());
    render(<OptionalHolidaySelectionCard catalog={catalogFixture()} onSave={onSave} />);

    fireEvent.click(screen.getByTestId("oh-checkbox-ev-1"));
    fireEvent.click(screen.getByTestId("oh-checkbox-ev-2"));
    fireEvent.click(screen.getByRole("button", { name: /Save selections/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(["ev-3", "ev-2"]);
    });
  });

  it("leaves local state unchanged after a failed PUT", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("server said no"));
    render(<OptionalHolidaySelectionCard catalog={catalogFixture()} onSave={onSave} />);

    fireEvent.click(screen.getByTestId("oh-checkbox-ev-2"));
    fireEvent.click(screen.getByRole("button", { name: /Save selections/i }));

    await waitFor(() => {
      expect(screen.getByText(/server said no|Could not save/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId("oh-checkbox-ev-2")).toBeChecked();
    expect(screen.getByTestId("oh-checkbox-ev-1")).toBeChecked();
  });
});
