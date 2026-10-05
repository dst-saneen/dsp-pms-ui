import type { PayrollRunStatus } from "../types";

export function formatPayrollRunStatus(status: PayrollRunStatus): string {
  if (status === "LEGACY_IMPORTED") {
    return "Imported";
  }

  return status
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
