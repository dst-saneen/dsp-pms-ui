import type {
  EmployeeLeaveBalanceGroup,
  EmployeeLeaveBalanceRow,
} from "../types/leave-balance";

function employeeName(row: EmployeeLeaveBalanceRow): string {
  const first = row.employee?.firstName?.trim() ?? "";
  const last = row.employee?.lastName?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || "Employee";
}

export function groupLeaveBalancesByEmployee(
  rows: EmployeeLeaveBalanceRow[],
): EmployeeLeaveBalanceGroup[] {
  const groups = new Map<string, EmployeeLeaveBalanceGroup>();

  for (const row of rows) {
    const employeeId = row.employeeId;
    const existing = groups.get(employeeId);
    if (!existing) {
      groups.set(employeeId, {
        employeeId,
        employeeCode: row.employee?.employeeCode ?? "—",
        employeeName: employeeName(row),
        companyName: row.employee?.company?.companyName ?? "—",
        branchName: row.employee?.branch?.branchName ?? "—",
        designationName: row.employee?.designation?.designationName ?? "—",
        balances: [row],
        totals: {
          entitlement: Number(row.entitlement),
          used: Number(row.used),
          pending: Number(row.pending),
          available: Number(row.balance),
        },
      });
      continue;
    }

    existing.balances.push(row);
    existing.totals.entitlement += Number(row.entitlement);
    existing.totals.used += Number(row.used);
    existing.totals.pending += Number(row.pending);
    existing.totals.available += Number(row.balance);
  }

  return [...groups.values()].sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName),
  );
}
