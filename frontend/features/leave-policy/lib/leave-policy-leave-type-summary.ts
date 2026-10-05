import type { LeavePolicy } from "../types/leave-policy";
import { formatAnnualEntitlement } from "./leave-entitlement";

/** One row per leave type (and branch), not per designation. */
export interface LeaveTypePolicySummary {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  branchId: string | null;
  branchName: string;
  companyName: string;
  designationCount: number;
  /** Policy ids in this leave-type × branch group (for batch updates). */
  policyIds: string[];
  /** Single days/year when all designation policies match; otherwise null. */
  daysPerYear: number | null;
  daysPerYearLabel: string;
  /**
   * Shared carry-forward limit when all policies agree.
   * null = all unset; undefined = mixed values across designations.
   */
  carryForwardValue: number | null | undefined;
  carryForwardLabel: string;
  negativeLabel: "Allowed" | "Not allowed" | "Mixed";
  allowNegativeMixed: boolean;
}

function uniqueSortedNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value == null ? null : Number(value)))
        .filter((value): value is number => value != null && Number.isFinite(value))
    )
  ).sort((a, b) => a - b);
}

export function buildLeaveTypePolicySummaries(policies: LeavePolicy[]): LeaveTypePolicySummary[] {
  const active = policies.filter((policy) => policy.isActive !== false);
  const groups = new Map<string, LeavePolicy[]>();

  for (const policy of active) {
    const leaveTypeId = policy.leaveTypeId || policy.leaveType?.id;
    if (!leaveTypeId) continue;
    const key = `${policy.branchId ?? "company"}:${leaveTypeId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(policy);
    else groups.set(key, [policy]);
  }

  const summaries: LeaveTypePolicySummary[] = [];

  for (const [key, rows] of groups) {
    const sample = rows[0];
    const leaveTypeName = sample.leaveType?.leaveName ?? sample.leaveTypeId ?? "Leave type";
    const leaveTypeCode = sample.leaveType?.leaveCode ?? "—";
    const days = uniqueSortedNumbers(rows.map((row) => row.annualEntitlement));
    const carry = uniqueSortedNumbers(rows.map((row) => row.carryForwardLimit));
    const allCarryUnset = rows.every(
      (row) => row.carryForwardLimit == null || row.carryForwardLimit === undefined
    );
    const negativeFlags = Array.from(new Set(rows.map((row) => Boolean(row.allowNegativeBalance))));

    const designationIds = new Set(
      rows.map((row) => row.designationId).filter((id): id is string => Boolean(id))
    );

    let carryForwardValue: number | null | undefined;
    if (allCarryUnset) {
      carryForwardValue = null;
    } else if (carry.length === 1) {
      carryForwardValue = carry[0];
    } else {
      carryForwardValue = undefined;
    }

    summaries.push({
      id: key,
      leaveTypeId: sample.leaveTypeId,
      leaveTypeName,
      leaveTypeCode,
      branchId: sample.branchId,
      branchName: sample.branchId ? (sample.branch?.branchName ?? "—") : "Company default",
      companyName: sample.company?.companyName ?? "—",
      designationCount: designationIds.size || rows.length,
      policyIds: rows.map((row) => row.id),
      daysPerYear: days.length === 1 ? days[0] : null,
      daysPerYearLabel:
        days.length === 0
          ? "—"
          : days.length === 1
            ? formatAnnualEntitlement(days[0])
            : `Varies (${days.map(formatAnnualEntitlement).join("–")})`,
      carryForwardValue,
      carryForwardLabel:
        carryForwardValue === undefined
          ? `Varies (${carry.join("–")})`
          : carryForwardValue == null
            ? "—"
            : String(carryForwardValue),
      negativeLabel:
        negativeFlags.length === 1 ? (negativeFlags[0] ? "Allowed" : "Not allowed") : "Mixed",
      allowNegativeMixed: negativeFlags.length > 1,
    });
  }

  return summaries.sort((a, b) => {
    const branchCmp = a.branchName.localeCompare(b.branchName);
    if (branchCmp !== 0) return branchCmp;
    return a.leaveTypeName.localeCompare(b.leaveTypeName);
  });
}
