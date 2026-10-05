import { describe, expect, it } from "vitest";

import { formatPayrollRunStatus } from "./payroll-run-status";

describe("formatPayrollRunStatus", () => {
  it("uses Imported instead of exposing the historical database enum", () => {
    expect(formatPayrollRunStatus("LEGACY_IMPORTED")).toBe("Imported");
  });

  it("keeps current payroll statuses readable", () => {
    expect(formatPayrollRunStatus("CALCULATED")).toBe("Calculated");
  });
});
