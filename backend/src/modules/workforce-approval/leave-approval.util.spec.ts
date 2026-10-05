import {
  canAccessLeaveHrQueue,
  canActOnLeaveApprovalStep,
  isLeaveHrActorRole,
} from './leave-approval.util';

describe('canActOnLeaveApprovalStep', () => {
  it('allows the assigned approver', () => {
    expect(
      canActOnLeaveApprovalStep({
        actorEmployeeId: 'mgr-1',
        subjectEmployeeId: 'emp-1',
        currentApproverId: 'mgr-1',
        currentStepKind: 'REPORTING_MANAGER',
      }),
    ).toBe(true);
  });

  it('allows scoped HR with leave.manage on the HR step', () => {
    expect(
      canActOnLeaveApprovalStep({
        actorEmployeeId: 'emp-hr-2',
        subjectEmployeeId: 'emp-1',
        currentApproverId: 'emp-hr-older',
        currentStepKind: 'HR',
        actorPermissions: ['hr.leave.manage'],
        actorIsScopedLeaveHr: true,
      }),
    ).toBe(true);
  });

  it('rejects permission-only HR without scoped role proof', () => {
    expect(
      canActOnLeaveApprovalStep({
        actorEmployeeId: 'emp-other',
        subjectEmployeeId: 'emp-1',
        currentApproverId: 'emp-hr-older',
        currentStepKind: 'HR',
        actorPermissions: ['hr.leave.manage'],
      }),
    ).toBe(false);
  });

  it('rejects a prior-step approver from acting again', () => {
    expect(
      canActOnLeaveApprovalStep({
        actorEmployeeId: 'mgr-1',
        subjectEmployeeId: 'emp-1',
        currentApproverId: 'emp-hr',
        currentStepKind: 'HR',
        actorPermissions: ['hr.leave.manage'],
        actorIsScopedLeaveHr: true,
        priorStepApproverIds: ['mgr-1'],
      }),
    ).toBe(false);
  });
});

describe('canAccessLeaveHrQueue', () => {
  it('requires hr.leave.manage and an HR actor role', () => {
    expect(
      canAccessLeaveHrQueue({
        permissions: ['hr.leave.manage'],
        roles: ['HR_MANAGER'],
      }),
    ).toBe(true);
    expect(
      canAccessLeaveHrQueue({
        permissions: ['hr.leave.manage'],
        roles: ['PROJECT_MANAGER'],
      }),
    ).toBe(false);
  });
});

describe('isLeaveHrActorRole', () => {
  it('recognizes HR fallback roles', () => {
    expect(isLeaveHrActorRole('HR_MANAGER')).toBe(true);
    expect(isLeaveHrActorRole('PROJECT_MANAGER')).toBe(false);
  });
});
