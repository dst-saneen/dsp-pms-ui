import { createHash } from 'node:crypto';

export const LEAVE_POLICY_MATRIX_MAX_CELLS = 1000;
export const LEAVE_POLICY_MATRIX_IMPACT_SAMPLE = 50;

export function leavePolicyMatrixLockKey(
  branchId: string,
  departmentId: string | null,
): string {
  return `leave-policy-matrix:${branchId}:${departmentId ?? ''}`;
}

export function buildLeavePolicyMatrixSnapshotToken(
  policies: Array<{
    id: string;
    updatedAt: Date;
    isActive: boolean;
    designationId: string | null;
    leaveTypeId: string;
    annualEntitlement: { toString(): string } | number | string;
  }>,
): string {
  const rows = [...policies]
    .map((policy) =>
      [
        policy.id,
        policy.updatedAt.toISOString(),
        policy.isActive ? '1' : '0',
        policy.designationId ?? '',
        policy.leaveTypeId,
        String(policy.annualEntitlement),
      ].join(':'),
    )
    .sort();
  return createHash('sha256').update(rows.join('|')).digest('hex');
}
