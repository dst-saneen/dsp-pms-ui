import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  buildWorkflowScopeKey,
  WorkforceApprovalResolverService,
} from './workforce-approval-resolver.service';

describe('buildWorkflowScopeKey', () => {
  it('builds global and company scope keys', () => {
    expect(buildWorkflowScopeKey('leave_approval')).toBe(
      'GLOBAL:LEAVE_APPROVAL',
    );
    expect(buildWorkflowScopeKey('OVERTIME_APPROVAL', 'co-1')).toBe(
      'COMPANY:co-1:OVERTIME_APPROVAL',
    );
  });
});

describe('WorkforceApprovalResolverService', () => {
  const prisma = {
    approvalWorkflow: {
      findFirst: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const service = new WorkforceApprovalResolverService(prisma as never);

  function hrFallbackRoleCodes(): string[] {
    const calls = prisma.user.findFirst.mock.calls as unknown as Array<
      [
        {
          where?: {
            roleAssignments?: {
              some?: { role?: { code?: { in?: string[] } } };
            };
          };
        },
      ]
    >;
    return calls.flatMap(
      (call) => call[0].where?.roleAssignments?.some?.role?.code?.in ?? [],
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveWorkflow', () => {
    it('prefers company workflow over global', async () => {
      prisma.approvalWorkflow.findFirst
        .mockResolvedValueOnce({
          id: 'company-wf',
          scopeKey: 'COMPANY:c1:LEAVE_APPROVAL',
          steps: [{ stepNo: 1 }],
        })
        .mockResolvedValueOnce(null);

      const result = await service.resolveWorkflow({
        workflowCode: 'LEAVE_APPROVAL',
        companyId: 'c1',
      });

      expect(result.resolutionSource).toBe('COMPANY');
      expect(result.id).toBe('company-wf');
      expect(prisma.approvalWorkflow.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.approvalWorkflow.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scopeKey: 'COMPANY:c1:LEAVE_APPROVAL',
            isActive: true,
          }),
        }),
      );
    });

    it('falls back to global when company workflow missing', async () => {
      prisma.approvalWorkflow.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'global-wf',
          scopeKey: 'GLOBAL:LEAVE_APPROVAL',
          steps: [],
        });

      const result = await service.resolveWorkflow({
        workflowCode: 'LEAVE_APPROVAL',
        companyId: 'c1',
      });

      expect(result.resolutionSource).toBe('GLOBAL');
      expect(result.id).toBe('global-wf');
    });
  });

  describe('resolveApproverEmployeeId', () => {
    it('uses reporting manager when eligible in tenant scope', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce({
        branchId: 'b1',
        company: { companyGroupId: 'g1' },
      });
      prisma.user.findFirst.mockResolvedValueOnce({ employeeId: 'mgr-1' });

      const result = await service.resolveApproverEmployeeId({
        companyId: 'c1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-1',
        step: { approverType: 'REPORTING_MANAGER', approverRole: null },
      });

      expect(result).toBe('mgr-1');
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
            employeeId: 'mgr-1',
            roleAssignments: {
              some: expect.objectContaining({
                isActive: true,
                OR: [
                  { branchId: 'b1' },
                  { companyId: 'c1', branchId: null },
                  { companyGroupId: 'g1' },
                ],
                role: expect.objectContaining({
                  isActive: true,
                  permissions: {
                    some: {
                      permission: { code: 'hr.team.approve' },
                    },
                  },
                }),
              }),
            },
          }),
        }),
      );
    });

    it('skips a manager without active login or team.approve', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce({
        branchId: 'b1',
        company: { companyGroupId: 'g1' },
      });
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'hr-1' });

      const result = await service.resolveApproverEmployeeId({
        companyId: 'c1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-no-login',
        step: { approverType: 'REPORTING_MANAGER', approverRole: null },
      });

      expect(result).toBe('hr-1');
    });

    it('falls back to HR then admin when manager missing', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce({
        branchId: 'b1',
        company: { companyGroupId: null },
      });
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'admin-1' });

      const result = await service.resolveApproverEmployeeId({
        companyId: 'c1',
        subjectEmployeeId: 'emp-1',
        managerId: null,
        step: { approverType: 'REPORTING_MANAGER', approverRole: null },
      });

      expect(result).toBe('admin-1');
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
            roleAssignments: {
              some: expect.objectContaining({
                role: { isActive: true, code: { in: ['HR_MANAGER'] } },
              }),
            },
          }),
        }),
      );
    });

    it('never returns the subject employee as approver', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.resolveApproverEmployeeId({
        companyId: 'c1',
        subjectEmployeeId: 'emp-1',
        managerId: 'emp-1',
        step: { approverType: 'REPORTING_MANAGER', approverRole: null },
      });

      expect(result).toBeNull();
      expect(prisma.employee.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).toHaveBeenCalled();
    });
  });

  describe('resolveLeaveApprovalSteps', () => {
    it('skips an ineligible manager and assigns HR', async () => {
      prisma.user.findFirst.mockResolvedValue({ employeeId: 'emp-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: null,
        workflowSteps: [
          { stepNo: 1, approverType: 'REPORTING_MANAGER', approverRole: null },
          { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
        ],
      });

      expect(result.currentStep).toBe(2);
      expect(result.steps[0]).toMatchObject({
        name: 'REPORTING_MANAGER',
        status: 'SKIPPED',
      });
      expect(result.steps[1]).toMatchObject({
        name: 'HR',
        approverId: 'emp-hr',
        status: 'PENDING',
      });
    });

    it('skips a manager who has no active login or team.approve', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'emp-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-no-login',
        workflowSteps: [],
      });

      expect(result.steps[0]).toMatchObject({
        name: 'REPORTING_MANAGER',
        status: 'SKIPPED',
        approverId: null,
      });
      expect(result.currentStep).toBe(2);
      expect(result.steps[1]).toMatchObject({
        name: 'HR',
        approverId: 'emp-hr',
        status: 'PENDING',
      });
    });

    it('skips a manager whose team.approve is outside the subject tenant scope', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'emp-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-foreign-scope',
        workflowSteps: [],
      });

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'mgr-foreign-scope',
            roleAssignments: {
              some: expect.objectContaining({
                OR: [
                  { branchId: 'b1' },
                  { companyId: 'c1', branchId: null },
                  { companyGroupId: 'g1' },
                ],
              }),
            },
          }),
        }),
      );
      expect(result.steps[0]).toMatchObject({
        name: 'REPORTING_MANAGER',
        status: 'SKIPPED',
        approverId: null,
      });
      expect(result.steps[1]).toMatchObject({
        name: 'HR',
        approverId: 'emp-hr',
        status: 'PENDING',
      });
    });

    it('skips the manager when the same person would be HR', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ employeeId: 'emp-hr' })
        .mockResolvedValueOnce({ employeeId: 'emp-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'emp-hr',
        workflowSteps: [],
      });

      expect(result.steps[0].status).toBe('SKIPPED');
      expect(result.steps[1].approverId).toBe('emp-hr');
    });

    it('fails when no HR fallback exists', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ employeeId: 'mgr-1' })
        .mockResolvedValue(null);

      await expect(
        service.resolveLeaveApprovalSteps({
          companyId: 'c1',
          branchId: 'b1',
          companyGroupId: 'g1',
          subjectEmployeeId: 'emp-1',
          managerId: 'mgr-1',
          workflowSteps: [],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
        }) as unknown,
      });
    });

    it('prefers branch HR over company HR', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ employeeId: 'mgr-1' })
        .mockResolvedValueOnce({ employeeId: 'emp-branch-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-1',
        workflowSteps: [],
      });

      expect(result.steps[0]).toMatchObject({
        name: 'REPORTING_MANAGER',
        status: 'PENDING',
        approverId: 'mgr-1',
      });
      expect(result.steps[1].approverId).toBe('emp-branch-hr');
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it('uses Group HR when branch and company HR are missing', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ employeeId: 'mgr-1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'emp-group-hr' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-1',
        workflowSteps: [],
      });

      expect(result.steps[1].approverId).toBe('emp-group-hr');
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(4);
      expect(hrFallbackRoleCodes()).toEqual([
        'HR_MANAGER',
        'HR_MANAGER',
        'HR_MANAGER',
      ]);
    });

    it('uses Company Admin then Org Owner and never Super Admin', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ employeeId: 'mgr-1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 'emp-owner' });

      const result = await service.resolveLeaveApprovalSteps({
        companyId: 'c1',
        branchId: 'b1',
        companyGroupId: 'g1',
        subjectEmployeeId: 'emp-1',
        managerId: 'mgr-1',
        workflowSteps: [],
      });

      expect(result.steps[1].approverId).toBe('emp-owner');
      expect(hrFallbackRoleCodes()).toEqual([
        'HR_MANAGER',
        'HR_MANAGER',
        'HR_MANAGER',
        'COMPANY_ADMINISTRATOR',
        'ORGANIZATION_OWNER',
      ]);
      expect(hrFallbackRoleCodes()).not.toContain('SUPER_ADMINISTRATOR');
    });
  });

  describe('isEmployeeScopedLeaveHrActor', () => {
    it('returns true for branch-scoped HR Manager with leave.manage', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-hr' });

      await expect(
        service.isEmployeeScopedLeaveHrActor({
          actorEmployeeId: 'emp-hr',
          subjectEmployeeId: 'emp-1',
          companyId: 'co-1',
          branchId: 'br-1',
          companyGroupId: 'g-1',
          actorPermissions: ['hr.leave.manage'],
        }),
      ).resolves.toBe(true);
    });

    it('returns false without hr.leave.manage', async () => {
      await expect(
        service.isEmployeeScopedLeaveHrActor({
          actorEmployeeId: 'emp-hr',
          subjectEmployeeId: 'emp-1',
          companyId: 'co-1',
          branchId: 'br-1',
          companyGroupId: null,
          actorPermissions: [],
        }),
      ).resolves.toBe(false);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('assertCurrentStepActor', () => {
    it('rejects self-approval', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'emp-1',
            status: 'PENDING',
            stepNo: 1,
          },
          actorEmployeeId: 'emp-1',
          subjectEmployeeId: 'emp-1',
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejects non-current approver', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'mgr-1',
            status: 'PENDING',
            stepNo: 1,
          },
          actorEmployeeId: 'other',
          subjectEmployeeId: 'emp-1',
        }),
      ).toThrow(ForbiddenException);
    });

    it('returns 409 when step already decided', () => {
      try {
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'mgr-1',
            status: 'APPROVED',
            stepNo: 1,
          },
          actorEmployeeId: 'mgr-1',
          subjectEmployeeId: 'emp-1',
        });
        fail('expected ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toMatchObject({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
        });
      }
    });

    it('allows override when actorCanOverrideAsApprover is set', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'mgr-1',
            status: 'PENDING',
            stepNo: 1,
          },
          actorEmployeeId: 'hr-1',
          subjectEmployeeId: 'emp-1',
          actorCanOverrideAsApprover: true,
        }),
      ).not.toThrow();
    });

    it('allows the assigned pending approver', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'mgr-1',
            status: 'PENDING',
            stepNo: 1,
          },
          actorEmployeeId: 'mgr-1',
          subjectEmployeeId: 'emp-1',
        }),
      ).not.toThrow();
    });

    it('allows in-scope HR to act on a snapshotted HR step', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's2',
            approverId: 'emp-hr-older',
            status: 'PENDING',
            stepNo: 2,
          },
          actorEmployeeId: 'emp-hr-2',
          subjectEmployeeId: 'emp-1',
          currentStepKind: 'HR',
          actorPermissions: ['hr.leave.manage'],
          actorIsScopedLeaveHr: true,
        }),
      ).not.toThrow();
    });

    it('rejects permission-only HR on the HR step', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's2',
            approverId: 'emp-hr-older',
            status: 'PENDING',
            stepNo: 2,
          },
          actorEmployeeId: 'emp-other',
          subjectEmployeeId: 'emp-1',
          currentStepKind: 'HR',
          actorPermissions: ['hr.leave.manage'],
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejects HR pool action on the manager step', () => {
      expect(() =>
        service.assertCurrentStepActor({
          currentStep: {
            id: 's1',
            approverId: 'mgr-1',
            status: 'PENDING',
            stepNo: 1,
          },
          actorEmployeeId: 'emp-hr-2',
          subjectEmployeeId: 'emp-1',
          currentStepKind: 'REPORTING_MANAGER',
          actorPermissions: ['hr.leave.manage'],
        }),
      ).toThrow(ForbiddenException);
    });
  });
});
