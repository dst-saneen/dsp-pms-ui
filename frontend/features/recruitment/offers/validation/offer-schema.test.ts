import { describe, expect, it } from "vitest";

import { offerDraftSchema } from "./offer-schema";

describe("offerDraftSchema", () => {
  it("requires positive compensation before send", () => {
    const result = offerDraftSchema.safeParse({
      roleTitle: "BIM Engineer",
      reportingManagerEmployeeId: "66666666-6666-6666-6666-666666666666",
      employmentType: "FULL_TIME",
      joiningDate: "2026-09-01",
      compensationAmount: 0,
      compensationCurrency: "INR",
      compensationPeriod: "MONTHLY",
      probationDays: 90,
      expiryDate: "2026-08-31",
    });

    expect(result.success).toBe(false);
  });
});
