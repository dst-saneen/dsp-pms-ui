import { describe, expect, it } from "vitest";

import { branchSchema, toBranchPayload } from "./branch-schema";

const validBranch = {
  companyId: "company-id",
  branchName: "Kochi Headquarters QA",
  addressLine1: "",
  addressLine2: "",
  city: "Kochi",
  state: "Kerala",
  postalCode: "",
  countryCode: "in",
  countrySubdivisionCode: "in-kl",
  timezone: "Asia/Kolkata",
  isActive: true,
};

describe("branchSchema location contract", () => {
  it("requires and normalizes country, subdivision, and timezone", () => {
    const parsed = branchSchema.parse(validBranch);

    expect(toBranchPayload(parsed)).toMatchObject({
      countryCode: "IN",
      countrySubdivisionCode: "IN-KL",
      timezone: "Asia/Kolkata",
    });
  });

  it.each([
    ["countryCode", ""],
    ["countrySubdivisionCode", "Kerala"],
    ["timezone", "India time"],
  ] as const)("rejects an invalid %s", (field, value) => {
    expect(branchSchema.safeParse({ ...validBranch, [field]: value }).success).toBe(false);
  });
});
