import { describe, expect, it } from "vitest";

import * as workspace from "./version-workspace";
import { resolveHolidayEventFlags } from "./optional-holiday-event";

describe("business calendar event dates", () => {
  it("uses the start date for a one-day event", () => {
    const resolveEndDate = (
      workspace as unknown as {
        resolveBusinessCalendarEventEndDate: (
          startDate: string,
          endDate: string,
          multiDay: boolean
        ) => string;
      }
    ).resolveBusinessCalendarEventEndDate;

    expect(typeof resolveEndDate).toBe("function");
    expect(resolveEndDate("2026-10-02", "2026-10-05", false)).toBe("2026-10-02");
  });

  it("uses the inclusive end date for a multi-day event", () => {
    const resolveEndDate = (
      workspace as unknown as {
        resolveBusinessCalendarEventEndDate: (
          startDate: string,
          endDate: string,
          multiDay: boolean
        ) => string;
      }
    ).resolveBusinessCalendarEventEndDate;

    expect(resolveEndDate("2026-10-02", "2026-10-05", true)).toBe("2026-10-05");
  });
});

describe("resolveHolidayEventFlags", () => {
  it("forces single-day NONE unpaid when optional holiday is on", () => {
    expect(
      resolveHolidayEventFlags({
        isHoliday: true,
        isOptionalHoliday: true,
        multiDay: true,
        startDate: "2027-10-10",
        endDate: "2027-10-12",
        effect: "NON_WORKING_DAY",
        paidHoliday: true,
      })
    ).toEqual({
      multiDay: false,
      endDate: "2027-10-10",
      effect: "NONE",
      paidHoliday: false,
      isOptionalHoliday: true,
    });
  });

  it("leaves mandatory holiday flags alone when optional is off", () => {
    expect(
      resolveHolidayEventFlags({
        isHoliday: true,
        isOptionalHoliday: false,
        multiDay: false,
        startDate: "2027-08-15",
        endDate: "",
        effect: "NON_WORKING_DAY",
        paidHoliday: true,
      })
    ).toEqual({
      multiDay: false,
      endDate: "2027-08-15",
      effect: "NON_WORKING_DAY",
      paidHoliday: true,
      isOptionalHoliday: false,
    });
  });
});
