import { LeaveRequestStatus } from '../employee-leave/constants';

import {
  buildLeaveApprovalProgress,
  leaveCalendarApprovalStage,
} from './leave-request-progress';

describe('buildLeaveApprovalProgress', () => {
  const actor = {
    id: 'user-1',
    username: 'mgr',
    mustChangePassword: false,
    sessionId: 'sess-1',
    employeeId: 'emp-manager',
    authorization: {
      roles: [],
      permissions: [],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      activeCompanyId: 'co-1',
      availableScopes: [],
    },
  };

  it('marks the current manager as able to act and HR as final', () => {
    const progress = buildLeaveApprovalProgress(
      {
        status: LeaveRequestStatus.SUBMITTED,
        requestedDays: 2,
        employeeId: 'emp-1',
        leaveBalance: {
          year: 2026,
          entitlement: 12,
          used: 1,
          pending: 2,
          balance: 9,
        },
        approvalTransaction: {
          currentStep: 1,
          status: 'PENDING',
          workflow: {
            steps: [
              {
                stepNo: 1,
                approverType: 'REPORTING_MANAGER',
                approverRole: null,
              },
              {
                stepNo: 2,
                approverType: 'ROLE',
                approverRole: 'HR_MANAGER',
              },
            ],
          },
          approvalSteps: [
            {
              stepNo: 1,
              status: 'PENDING',
              approverId: 'emp-manager',
              actionDate: null,
            },
            {
              stepNo: 2,
              status: 'PENDING',
              approverId: 'emp-hr',
              actionDate: null,
            },
          ],
        },
      },
      actor,
    );

    expect(progress.stage).toBe('MANAGER_REVIEW');
    expect(progress.canAct).toBe(true);
    expect(progress.isFinalStep).toBe(false);
    expect(progress.balancePreview?.afterApprove.used).toBe(3);
    expect(progress.balancePreview?.afterReject.available).toBe(11);
  });

  it('lets in-scope HR act on the HR step even when another HR is snapshotted', () => {
    const hrActor = {
      ...actor,
      employeeId: 'emp-hr-2',
      authorization: {
        ...actor.authorization,
        permissions: ['hr.leave.manage'],
        roles: ['HR_MANAGER'],
      },
    };
    const progress = buildLeaveApprovalProgress(
      {
        status: LeaveRequestStatus.SUBMITTED,
        requestedDays: 1,
        employeeId: 'emp-1',
        approvalTransaction: {
          currentStep: 2,
          status: 'PENDING',
          workflow: {
            steps: [
              {
                stepNo: 1,
                approverType: 'REPORTING_MANAGER',
                approverRole: null,
              },
              {
                stepNo: 2,
                approverType: 'ROLE',
                approverRole: 'HR_MANAGER',
              },
            ],
          },
          approvalSteps: [
            {
              stepNo: 1,
              status: 'APPROVED',
              approverId: 'emp-manager',
              actionDate: new Date('2026-08-11T10:00:00.000Z'),
            },
            {
              stepNo: 2,
              status: 'PENDING',
              approverId: 'emp-hr-older',
              actionDate: null,
            },
          ],
        },
      },
      hrActor,
      { actorIsScopedLeaveHr: true },
    );

    expect(progress.stage).toBe('HR_REVIEW');
    expect(progress.canAct).toBe(true);
  });

  it('blocks permission-only users from acting on the HR step', () => {
    const progress = buildLeaveApprovalProgress(
      {
        status: LeaveRequestStatus.SUBMITTED,
        requestedDays: 1,
        employeeId: 'emp-1',
        approvalTransaction: {
          currentStep: 2,
          status: 'PENDING',
          workflow: {
            steps: [
              {
                stepNo: 1,
                approverType: 'REPORTING_MANAGER',
                approverRole: null,
              },
              {
                stepNo: 2,
                approverType: 'ROLE',
                approverRole: 'HR_MANAGER',
              },
            ],
          },
          approvalSteps: [
            {
              stepNo: 1,
              status: 'APPROVED',
              approverId: 'emp-manager',
              actionDate: new Date('2026-08-11T10:00:00.000Z'),
            },
            {
              stepNo: 2,
              status: 'PENDING',
              approverId: 'emp-hr',
              actionDate: null,
            },
          ],
        },
      },
      {
        ...actor,
        authorization: {
          ...actor.authorization,
          permissions: ['hr.leave.manage'],
          roles: ['PROJECT_MANAGER'],
        },
      },
    );

    expect(progress.stage).toBe('HR_REVIEW');
    expect(progress.canAct).toBe(false);
  });

  it('blocks the manager who already decided from acting on the HR step', () => {
    const progress = buildLeaveApprovalProgress(
      {
        status: LeaveRequestStatus.SUBMITTED,
        requestedDays: 1,
        employeeId: 'emp-1',
        approvalTransaction: {
          currentStep: 2,
          status: 'PENDING',
          workflow: {
            steps: [
              {
                stepNo: 1,
                approverType: 'REPORTING_MANAGER',
                approverRole: null,
              },
              {
                stepNo: 2,
                approverType: 'ROLE',
                approverRole: 'HR_MANAGER',
              },
            ],
          },
          approvalSteps: [
            {
              stepNo: 1,
              status: 'APPROVED',
              approverId: 'emp-manager',
              actionDate: new Date('2026-08-11T10:00:00.000Z'),
            },
            {
              stepNo: 2,
              status: 'PENDING',
              approverId: 'emp-hr',
              actionDate: null,
            },
          ],
        },
      },
      {
        ...actor,
        authorization: {
          ...actor.authorization,
          permissions: ['hr.leave.manage'],
          roles: ['HR_MANAGER'],
        },
      },
      { actorIsScopedLeaveHr: true },
    );

    expect(progress.stage).toBe('HR_REVIEW');
    expect(progress.canAct).toBe(false);
  });

  it('maps calendar leave to manager review without exposing actor ids', () => {
    expect(
      leaveCalendarApprovalStage({
        status: LeaveRequestStatus.SUBMITTED,
        approvalTransaction: {
          currentStep: 1,
          status: 'PENDING',
          workflow: {
            steps: [
              {
                stepNo: 1,
                approverType: 'REPORTING_MANAGER',
                approverRole: null,
              },
              {
                stepNo: 2,
                approverType: 'ROLE',
                approverRole: 'HR_MANAGER',
              },
            ],
          },
          approvalSteps: [
            {
              stepNo: 1,
              status: 'PENDING',
              approverId: 'emp-manager',
              actionDate: null,
            },
            {
              stepNo: 2,
              status: 'PENDING',
              approverId: 'emp-hr',
              actionDate: null,
            },
          ],
        },
      }),
    ).toBe('MANAGER_REVIEW');
  });
});
