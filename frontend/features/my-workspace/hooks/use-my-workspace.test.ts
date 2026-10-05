import { describe, expect, it } from "vitest";

import { holidayCalendarRanges } from "./use-my-workspace";

describe("holidayCalendarRanges", () => {
  it("partitions a year into six non-overlapping ranges accepted by the 62-day calendar API", () => {
    const ranges = holidayCalendarRanges(2026);

    expect(ranges).toEqual([
      { fromDate: "2026-01-01", toDate: "2026-02-28" },
      { fromDate: "2026-03-01", toDate: "2026-04-30" },
      { fromDate: "2026-05-01", toDate: "2026-06-30" },
      { fromDate: "2026-07-01", toDate: "2026-08-31" },
      { fromDate: "2026-09-01", toDate: "2026-10-31" },
      { fromDate: "2026-11-01", toDate: "2026-12-31" },
    ]);

    for (const range of ranges) {
      const start = new Date(`${range.fromDate}T00:00:00Z`);
      const end = new Date(`${range.toDate}T00:00:00Z`);
      const inclusiveDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      expect(inclusiveDays).toBeLessThanOrEqual(62);
    }
  });
});
