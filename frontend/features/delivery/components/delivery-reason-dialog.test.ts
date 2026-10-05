import { describe, expect, it } from "vitest";

import { deliveryReasonSchema } from "./delivery-reason-dialog";

describe("deliveryReasonSchema", () => {
  it("requires a non-empty reason", () => {
    expect(deliveryReasonSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(deliveryReasonSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(
      deliveryReasonSchema.safeParse({ reason: "Provider timeout — retry after fix" })
        .success,
    ).toBe(true);
  });
});
