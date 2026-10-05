import { describe, expect, it } from "vitest";

import { groupPreflightIssues, summarizePayrollWarnings } from "./preflight-copy";

describe("payroll preflight guidance", () => {
  it("uses valid payroll tab routes and production-neutral copy", () => {
    const groups = groupPreflightIssues([
      { code: "MISSING_SALARY_REVISION", message: "missing salary" },
      { code: "MISSING_TAX_PROFILE", message: "missing tax" },
    ]);

    expect(groups.map((group) => group.href)).toEqual([
      "/hr/payroll?tab=salaries",
      "/hr/payroll?tab=tax",
    ]);
    expect(groups.map((group) => group.meaning).join(" ")).not.toMatch(/first test|₹|Kochi|2026/i);
  });

  it("summarizes warnings by stable code instead of message wording", () => {
    expect(
      summarizePayrollWarnings([
        { code: "MISSING_SALARY_REVISION", message: "localized salary text" },
        { code: "MISSING_TAX_PROFILE", message: "localized tax text" },
        { code: "JOINER_IN_PERIOD", message: "localized joiner text" },
      ])
    ).toEqual({ noSalary: 1, noTax: 1, other: 1, total: 3 });
  });
});
