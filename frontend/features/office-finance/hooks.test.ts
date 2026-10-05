import { describe, expect, it } from "vitest";

import { toFinanceSettingsView } from "./lib/settings-view";
import type { FinancialProfile } from "./types";

const profile: FinancialProfile = {
  id: "profile-1",
  companyId: "company-1",
  baseCurrencyCode: "INR",
  reportingStartDate: "2026-01-01",
  payrollExpenseCategoryId: null,
  version: 3,
  allowedActions: ["EDIT"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("toFinanceSettingsView", () => {
  it("treats a missing profile as create-ready", () => {
    expect(toFinanceSettingsView(null)).toEqual({ profile: null });
  });

  it("reads a nested settings payload", () => {
    expect(
      toFinanceSettingsView({
        profile,
        categories: [],
        paymentAccounts: [],
      }),
    ).toEqual({ profile });
  });

  it("reads a flat financial profile payload", () => {
    expect(toFinanceSettingsView(profile)).toEqual({ profile });
  });
});
