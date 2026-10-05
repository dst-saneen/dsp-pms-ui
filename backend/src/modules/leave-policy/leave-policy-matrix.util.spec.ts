import { Prisma } from '@prisma/client';

import {
  buildLeavePolicyMatrixSnapshotToken,
  leavePolicyMatrixLockKey,
} from './leave-policy-matrix.util';

describe('leave-policy-matrix.util', () => {
  it('scopes the advisory lock to branch and optional department', () => {
    expect(leavePolicyMatrixLockKey('br-1', null)).toBe(
      'leave-policy-matrix:br-1:',
    );
    expect(leavePolicyMatrixLockKey('br-1', 'dept-1')).toBe(
      'leave-policy-matrix:br-1:dept-1',
    );
  });

  it('builds a stable snapshot token regardless of input order', () => {
    const updatedAt = new Date('2026-08-11T00:00:00.000Z');
    const a = {
      id: 'pol-1',
      designationId: 'des-1',
      leaveTypeId: 'lt-1',
      annualEntitlement: new Prisma.Decimal(12),
      isActive: true,
      updatedAt,
    };
    const b = {
      id: 'pol-2',
      designationId: null,
      leaveTypeId: 'lt-1',
      annualEntitlement: 10,
      isActive: true,
      updatedAt,
    };

    expect(buildLeavePolicyMatrixSnapshotToken([a, b])).toBe(
      buildLeavePolicyMatrixSnapshotToken([b, a]),
    );
    expect(buildLeavePolicyMatrixSnapshotToken([a, b])).not.toBe(
      buildLeavePolicyMatrixSnapshotToken([{ ...a, annualEntitlement: 15 }, b]),
    );
  });
});
