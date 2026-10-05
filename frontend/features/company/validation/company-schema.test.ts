import { describe, expect, it } from "vitest";

import { companySchema } from "./company-schema";

const validCompany = {
  companyGroupId: "",
  companyName: "DSP India Services Pvt Ltd QA",
  registrationNo: "DSP-IN-QA-SYNTHETIC",
  taxNumber: "DSP-IN-QA-TAX",
  legalCountryCode: "in",
  parentCompanyId: "",
  isActive: true,
};

describe("companySchema legal country", () => {
  it("normalizes a valid ISO alpha-2 country code", () => {
    expect(companySchema.parse(validCompany).legalCountryCode).toBe("IN");
  });

  it("rejects a missing or non-alpha-2 legal country", () => {
    expect(
      companySchema.safeParse({ ...validCompany, legalCountryCode: "" }).success,
    ).toBe(false);
    expect(
      companySchema.safeParse({ ...validCompany, legalCountryCode: "India" })
        .success,
    ).toBe(false);
  });
});
