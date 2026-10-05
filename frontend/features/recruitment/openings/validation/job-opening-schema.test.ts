import { describe, expect, it } from "vitest";

import { getCriteriaWeightTotal } from "./job-opening-schema";

describe("getCriteriaWeightTotal", () => {
  it("totals only active criteria weights", () => {
    const total = getCriteriaWeightTotal([
      { weightPercentage: 60, isActive: true },
      { weightPercentage: 40, isActive: true },
      { weightPercentage: 25, isActive: false },
    ]);

    expect(total).toBe(100);
  });
});
