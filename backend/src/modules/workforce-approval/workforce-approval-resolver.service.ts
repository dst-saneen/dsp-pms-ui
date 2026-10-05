import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalTransactionStep,
  ApprovalWorkflow,
  ApprovalWorkflowStep,
  Prisma,
  UserStatus,
} from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import {
  WorkforcePermission,
  WorkforceWorkflowCode,
} from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canActOnLeaveApprovalStep,
  isLeaveHrWorkflowStep,
  isLeaveManagerWorkflowStep,
  leaveApprovalStepLabel,
  type LeaveApprovalStepName,
  type LeaveApprovalStepSnapshot,
} from './leave-approval.util';

export type WorkforceWorkflowCodeValue =
  (typeof WorkforceWorkflowCode)[keyof typeof WorkforceWorkflowCode];

export type PrismaTx = Prisma.TransactionClient;

export interface ResolveWorkflowInput {
  workflowCode: WorkforceWorkflowCodeValue;
  companyId: string;
}

export type ResolvedApprovalWorkflow = ApprovalWorkflow & {
  steps: ApprovalWorkflowStep[];
  resolutionSource: 'COMPANY' | 'GLOBAL';
};

export interface ResolveApproverInput {
  companyId: string;
  /** Subject employee whose request is being approved. */
  subjectEmployeeId: string;
  /** Optional; loaded from the subject employee when omitted. */
  branchId?: string;
  companyGroupId?: string | null;
  managerId?: string | null;
  step: Pick<ApprovalWorkflowStep, 'approverType' | 'approverRole'>;
}

export interface ResolveLeaveApprovalChainInput {
  companyId: string;
  branchId: string;
  companyGroupId: string | null;
  subjectEmployeeId: string;
  managerId?: string | null;
  workflowSteps: Array<
    Pick<ApprovalWorkflowStep, 'approverType' | 'approverRole' | 'stepNo'>
  >;
}

export interface AssertCurrentStepActorInput {
  currentStep: Pick<
    ApprovalTransactionStep,
    'id' | 'approverId' | 'status' | 'stepNo'
  >;
  actorEmployeeId: string | null | undefined;
  subjectEmployeeId: string;
  currentStepKind?: LeaveApprovalStepName | null;
  actorPermissions?: readonly string[];
  actorIsScopedLeaveHr?: boolean;
  priorStepApproverIds?: readonly (string | null | undefined)[];
  /**
   * When true (e.g. hr.overtime.approve), actor may decide the pending step
   * even if they were not the snapshotted approver — still never self-approve.
   */
  actorCanOverrideAsApprover?: boolean;
}

/**
 * Builds the server-owned workflow scope key.
 * API clients must never supply an arbitrary scopeKey.
 */
export function buildWorkflowScopeKey(
  workflowCode: string,
  companyId?: string | null,
): string {
  const code = workflowCode.trim().toUpperCase();
  if (!code) {
    throw new ConflictException({
      code: 'BAD_REQUEST',
      message: 'workflowCode is required',
    });
  }
  if (companyId) {
    return `COMPANY:${companyId}:${code}`;
  }
  return `GLOBAL:${code}`;
}

@Injectable()
export class WorkforceApprovalResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Company active workflow first, then global (plan §11.1).
   */
  async resolveWorkflow(
    input: ResolveWorkflowInput,
    tx?: PrismaTx,
  ): Promise<ResolvedApprovalWorkflow> {
    const db = tx ?? this.prisma;
    const code = input.workflowCode.trim().toUpperCase();
    const companyScopeKey = buildWorkflowScopeKey(code, input.companyId);
    const globalScopeKey = buildWorkflowScopeKey(code);

    const companyWorkflow = await db.approvalWorkflow.findFirst({
      where: {
        scopeKey: companyScopeKey,
        isActive: true,
      },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });

    if (companyWorkflow) {
      return { ...companyWorkflow, resolutionSource: 'COMPANY' };
    }

    const globalWorkflow = await db.approvalWorkflow.findFirst({
      where: {
        scopeKey: globalScopeKey,
        isActive: true,
      },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });

    if (globalWorkflow) {
      return { ...globalWorkflow, resolutionSource: 'GLOBAL' };
    }

    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: `Approval workflow ${code} is not configured`,
    });
  }

  /**
   * Default chain (plan §11.2): reporting manager → HR Manager →
   * Company Administrator / Organization Owner.
   * Never returns the subject employee (no self-approval).
   */
  async resolveApproverEmployeeId(
    input: ResolveApproverInput,
    tx?: PrismaTx,
  ): Promise<string | null> {
    const db = tx ?? this.prisma;
    const subjectId = input.subjectEmployeeId;
    const type = input.step.approverType.trim().toUpperCase();

    if (type === 'REPORTING_MANAGER') {
      if (input.managerId && input.managerId !== subjectId) {
        const scope = await this.resolveSubjectOfficeScope(db, {
          companyId: input.companyId,
          subjectEmployeeId: subjectId,
          branchId: input.branchId,
          companyGroupId: input.companyGroupId,
        });
        const managerId = await this.resolveEligibleManager(db, {
          companyId: input.companyId,
          branchId: scope.branchId,
          companyGroupId: scope.companyGroupId,
          managerId: input.managerId,
          subjectEmployeeId: subjectId,
        });
        if (managerId) {
          return managerId;
        }
      }
      return this.resolveFallbackApprover(db, input.companyId, subjectId);
    }

    if (type === 'ROLE' && input.step.approverRole) {
      const bySystemRole = await this.findEmployeeWithSystemRoles(
        db,
        input.companyId,
        [input.step.approverRole.trim().toUpperCase()],
        subjectId,
      );
      if (bySystemRole) {
        return bySystemRole;
      }

      const byDesignation = await db.employee.findFirst({
        where: {
          companyId: input.companyId,
          isActive: true,
          id: { not: subjectId },
          designation: {
            designationName: input.step.approverRole,
          },
        },
        select: { id: true },
      });
      return byDesignation?.id ?? null;
    }

    return null;
  }

  /**
   * Leave-only chain: Manager (skip if ineligible), optional custom steps, HR.
   * HR fallback: Branch HR → Company HR → Group HR → Company Admin → Org Owner.
   * Super Admin is never auto-selected. Same person cannot own Manager and HR.
   */
  async resolveLeaveApprovalSteps(
    input: ResolveLeaveApprovalChainInput,
    tx?: PrismaTx,
  ): Promise<{ currentStep: number; steps: LeaveApprovalStepSnapshot[] }> {
    const db = tx ?? this.prisma;
    const managerId = await this.resolveEligibleManager(db, {
      companyId: input.companyId,
      branchId: input.branchId,
      companyGroupId: input.companyGroupId,
      managerId: input.managerId,
      subjectEmployeeId: input.subjectEmployeeId,
    });
    const hrId = await this.resolveHrApproverEmployeeId(
      {
        companyId: input.companyId,
        branchId: input.branchId,
        companyGroupId: input.companyGroupId,
        subjectEmployeeId: input.subjectEmployeeId,
      },
      tx,
    );

    if (!hrId) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
        message: 'No eligible HR approver is available for this leave request',
      });
    }

    const eligibleManager = managerId && managerId !== hrId ? managerId : null;
    const snapshots: LeaveApprovalStepSnapshot[] = [];
    let stepNo = 0;

    stepNo += 1;
    snapshots.push({
      stepNo,
      name: 'REPORTING_MANAGER',
      label: leaveApprovalStepLabel('REPORTING_MANAGER'),
      approverId: eligibleManager,
      status: eligibleManager ? 'PENDING' : 'SKIPPED',
    });

    const extraSteps = [...input.workflowSteps]
      .sort((left, right) => left.stepNo - right.stepNo)
      .filter(
        (step) =>
          !isLeaveManagerWorkflowStep(step) && !isLeaveHrWorkflowStep(step),
      );

    for (const step of extraSteps) {
      const approverId = await this.resolveApproverEmployeeId(
        {
          companyId: input.companyId,
          branchId: input.branchId,
          companyGroupId: input.companyGroupId,
          subjectEmployeeId: input.subjectEmployeeId,
          managerId: input.managerId,
          step,
        },
        tx,
      );
      if (!approverId || approverId === input.subjectEmployeeId) {
        throw new ConflictException({
          code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
          message: 'An approval step has no eligible approver',
        });
      }
      if (approverId === hrId) {
        throw new ConflictException({
          code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
          message:
            'The same person cannot own consecutive leave approval steps',
        });
      }
      stepNo += 1;
      snapshots.push({
        stepNo,
        name: 'OTHER',
        label: leaveApprovalStepLabel('OTHER'),
        approverId,
        status: 'PENDING',
      });
    }

    stepNo += 1;
    snapshots.push({
      stepNo,
      name: 'HR',
      label: leaveApprovalStepLabel('HR'),
      approverId: hrId,
      status: 'PENDING',
    });

    const current = snapshots.find((step) => step.status === 'PENDING');
    if (!current) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
        message: 'No pending leave approver could be assigned',
      });
    }

    return { currentStep: current.stepNo, steps: snapshots };
  }

  async resolveHrApproverEmployeeId(
    input: {
      companyId: string;
      branchId: string;
      companyGroupId: string | null;
      subjectEmployeeId: string;
    },
    tx?: PrismaTx,
  ): Promise<string | null> {
    const db = tx ?? this.prisma;
    const exclude = input.subjectEmployeeId;

    const branchHr = await this.findEmployeeWithScopedRole(db, {
      roleCodes: ['HR_MANAGER'],
      excludeEmployeeId: exclude,
      employeeCompanyId: input.companyId,
      assignment: { branchId: input.branchId },
    });
    if (branchHr) return branchHr;

    const companyHr = await this.findEmployeeWithScopedRole(db, {
      roleCodes: ['HR_MANAGER'],
      excludeEmployeeId: exclude,
      employeeCompanyId: input.companyId,
      assignment: { companyId: input.companyId, branchId: null },
    });
    if (companyHr) return companyHr;

    if (input.companyGroupId) {
      const groupHr = await this.findEmployeeWithScopedRole(db, {
        roleCodes: ['HR_MANAGER'],
        excludeEmployeeId: exclude,
        employeeCompanyGroupId: input.companyGroupId,
        assignment: { companyGroupId: input.companyGroupId },
      });
      if (groupHr) return groupHr;
    }

    const companyAdmin = await this.findEmployeeWithScopedRole(db, {
      roleCodes: ['COMPANY_ADMINISTRATOR'],
      excludeEmployeeId: exclude,
      employeeCompanyId: input.companyId,
      assignment: { companyId: input.companyId },
    });
    if (companyAdmin) return companyAdmin;

    return this.findEmployeeWithScopedRole(db, {
      roleCodes: ['ORGANIZATION_OWNER'],
      excludeEmployeeId: exclude,
      employeeCompanyId: input.companyGroupId ? undefined : input.companyId,
      employeeCompanyGroupId: input.companyGroupId,
      assignment: input.companyGroupId
        ? { companyGroupId: input.companyGroupId }
        : { companyId: input.companyId },
    });
  }

  /**
   * Enforces no self-approval and current-step eligibility (plan §11.3).
   * Assigned approver may act; in-scope HR with hr.leave.manage and a scoped
   * HR role may act on the HR step. Repeated action on a non-PENDING step
   * returns 409.
   */
  assertCurrentStepActor(input: AssertCurrentStepActorInput): void {
    if (
      input.actorEmployeeId &&
      input.actorEmployeeId === input.subjectEmployeeId
    ) {
      throw new ForbiddenException({
        code: WorkforceTimeErrorCode.SELF_APPROVAL_FORBIDDEN,
        message: 'Approvers cannot act on their own request',
      });
    }

    if (input.currentStep.status !== 'PENDING') {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'This approval step has already been decided',
      });
    }

    if (input.actorCanOverrideAsApprover) {
      return;
    }

    if (
      !canActOnLeaveApprovalStep({
        actorEmployeeId: input.actorEmployeeId,
        subjectEmployeeId: input.subjectEmployeeId,
        currentApproverId: input.currentStep.approverId,
        currentStepKind: input.currentStepKind ?? null,
        actorPermissions: input.actorPermissions,
        actorIsScopedLeaveHr: input.actorIsScopedLeaveHr,
        priorStepApproverIds: input.priorStepApproverIds,
      })
    ) {
      const waitingOn =
        input.currentStepKind === 'REPORTING_MANAGER'
          ? 'the reporting manager'
          : input.currentStepKind === 'HR'
            ? 'HR'
            : 'the assigned approver for this step';
      throw new ForbiddenException({
        code: WorkforceTimeErrorCode.APPROVER_NOT_ELIGIBLE,
        message: `Only the current eligible approver can act (waiting on ${waitingOn})`,
      });
    }
  }

  /**
   * True when the actor holds hr.leave.manage and a scoped HR fallback role
   * for the subject employee's tenant (mirrors resolveHrApproverEmployeeId).
   */
  async isEmployeeScopedLeaveHrActor(
    input: {
      actorEmployeeId: string;
      subjectEmployeeId: string;
      companyId: string;
      branchId: string;
      companyGroupId: string | null;
      actorPermissions: readonly string[];
    },
    tx?: PrismaTx,
  ): Promise<boolean> {
    if (!input.actorPermissions.includes('hr.leave.manage')) {
      return false;
    }
    if (input.actorEmployeeId === input.subjectEmployeeId) {
      return false;
    }

    const db = tx ?? this.prisma;
    const tiers: Array<{
      roleCodes: string[];
      employeeCompanyId?: string;
      employeeCompanyGroupId?: string;
      assignment: {
        branchId?: string | null;
        companyId?: string | null;
        companyGroupId?: string | null;
      };
    }> = [
      {
        roleCodes: ['HR_MANAGER'],
        employeeCompanyId: input.companyId,
        assignment: { branchId: input.branchId },
      },
      {
        roleCodes: ['HR_MANAGER'],
        employeeCompanyId: input.companyId,
        assignment: { companyId: input.companyId, branchId: null },
      },
      {
        roleCodes: ['COMPANY_ADMINISTRATOR'],
        employeeCompanyId: input.companyId,
        assignment: { companyId: input.companyId },
      },
    ];

    if (input.companyGroupId) {
      tiers.splice(2, 0, {
        roleCodes: ['HR_MANAGER'],
        employeeCompanyGroupId: input.companyGroupId,
        assignment: { companyGroupId: input.companyGroupId },
      });
      tiers.push({
        roleCodes: ['ORGANIZATION_OWNER'],
        employeeCompanyGroupId: input.companyGroupId,
        assignment: { companyGroupId: input.companyGroupId },
      });
    } else {
      tiers.push({
        roleCodes: ['ORGANIZATION_OWNER'],
        employeeCompanyId: input.companyId,
        assignment: { companyId: input.companyId },
      });
    }

    for (const tier of tiers) {
      if (
        await this.employeeHasScopedRoleAssignment(db, {
          employeeId: input.actorEmployeeId,
          ...tier,
        })
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reporting manager is eligible only when they are an active employee in
   * the company, have an active login, and hold hr.team.approve on a role
   * assignment scoped to the subject's branch, company, or company group.
   * Otherwise return null so the manager step is skipped.
   */
  private async resolveEligibleManager(
    db: PrismaTx | PrismaService,
    input: {
      companyId: string;
      branchId: string;
      companyGroupId: string | null;
      managerId: string | null | undefined;
      subjectEmployeeId: string;
    },
  ): Promise<string | null> {
    if (!input.managerId || input.managerId === input.subjectEmployeeId) {
      return null;
    }

    const assignmentScopeOr: Prisma.UserRoleAssignmentWhereInput[] = [
      { branchId: input.branchId },
      { companyId: input.companyId, branchId: null },
    ];
    if (input.companyGroupId) {
      assignmentScopeOr.push({ companyGroupId: input.companyGroupId });
    }

    const user = await db.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        employeeId: input.managerId,
        employee: {
          id: input.managerId,
          companyId: input.companyId,
          isActive: true,
        },
        roleAssignments: {
          some: {
            isActive: true,
            OR: assignmentScopeOr,
            role: {
              isActive: true,
              permissions: {
                some: {
                  permission: {
                    code: WorkforcePermission.TEAM_APPROVE,
                  },
                },
              },
            },
          },
        },
      },
      select: { employeeId: true },
    });

    return user?.employeeId ?? null;
  }

  private async resolveSubjectOfficeScope(
    db: PrismaTx | PrismaService,
    input: {
      companyId: string;
      subjectEmployeeId: string;
      branchId?: string;
      companyGroupId?: string | null;
    },
  ): Promise<{ branchId: string; companyGroupId: string | null }> {
    if (input.branchId) {
      return {
        branchId: input.branchId,
        companyGroupId: input.companyGroupId ?? null,
      };
    }

    const subject = await db.employee.findFirst({
      where: {
        id: input.subjectEmployeeId,
        companyId: input.companyId,
        isActive: true,
      },
      select: {
        branchId: true,
        company: { select: { companyGroupId: true } },
      },
    });

    if (!subject?.branchId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee branch is required to resolve a reporting manager',
      });
    }

    return {
      branchId: subject.branchId,
      companyGroupId:
        input.companyGroupId !== undefined
          ? input.companyGroupId
          : (subject.company?.companyGroupId ?? null),
    };
  }

  private async resolveFallbackApprover(
    db: PrismaTx | PrismaService,
    companyId: string,
    subjectEmployeeId: string,
  ): Promise<string | null> {
    const hr = await this.findEmployeeWithSystemRoles(
      db,
      companyId,
      ['HR_MANAGER'],
      subjectEmployeeId,
    );
    if (hr) {
      return hr;
    }

    return this.findEmployeeWithSystemRoles(
      db,
      companyId,
      ['COMPANY_ADMINISTRATOR', 'ORGANIZATION_OWNER'],
      subjectEmployeeId,
    );
  }

  private async findEmployeeWithScopedRole(
    db: PrismaTx | PrismaService,
    params: {
      roleCodes: string[];
      excludeEmployeeId: string;
      employeeCompanyId?: string | null;
      employeeCompanyGroupId?: string | null;
      assignment: {
        branchId?: string | null;
        companyId?: string | null;
        companyGroupId?: string | null;
      };
    },
  ): Promise<string | null> {
    const assignmentWhere: Prisma.UserRoleAssignmentWhereInput = {
      isActive: true,
      role: {
        isActive: true,
        code: { in: params.roleCodes },
      },
    };
    if (params.assignment.branchId !== undefined) {
      assignmentWhere.branchId = params.assignment.branchId;
    }
    if (params.assignment.companyId !== undefined) {
      assignmentWhere.companyId = params.assignment.companyId;
    }
    if (params.assignment.companyGroupId !== undefined) {
      assignmentWhere.companyGroupId = params.assignment.companyGroupId;
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      isActive: true,
      id: { not: params.excludeEmployeeId },
    };
    if (params.employeeCompanyId) {
      employeeWhere.companyId = params.employeeCompanyId;
    }
    if (params.employeeCompanyGroupId) {
      employeeWhere.company = {
        companyGroupId: params.employeeCompanyGroupId,
      };
    }

    const user = await db.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        employeeId: { not: null },
        employee: employeeWhere,
        roleAssignments: { some: assignmentWhere },
      },
      select: { employeeId: true },
      orderBy: { createdAt: 'asc' },
    });

    return user?.employeeId ?? null;
  }

  private async employeeHasScopedRoleAssignment(
    db: PrismaTx | PrismaService,
    params: {
      employeeId: string;
      roleCodes: string[];
      employeeCompanyId?: string;
      employeeCompanyGroupId?: string;
      assignment: {
        branchId?: string | null;
        companyId?: string | null;
        companyGroupId?: string | null;
      };
    },
  ): Promise<boolean> {
    const assignmentWhere: Prisma.UserRoleAssignmentWhereInput = {
      isActive: true,
      role: {
        isActive: true,
        code: { in: params.roleCodes },
      },
    };
    if (params.assignment.branchId !== undefined) {
      assignmentWhere.branchId = params.assignment.branchId;
    }
    if (params.assignment.companyId !== undefined) {
      assignmentWhere.companyId = params.assignment.companyId;
    }
    if (params.assignment.companyGroupId !== undefined) {
      assignmentWhere.companyGroupId = params.assignment.companyGroupId;
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      id: params.employeeId,
      isActive: true,
    };
    if (params.employeeCompanyId) {
      employeeWhere.companyId = params.employeeCompanyId;
    }
    if (params.employeeCompanyGroupId) {
      employeeWhere.company = {
        companyGroupId: params.employeeCompanyGroupId,
      };
    }

    const user = await db.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        employeeId: params.employeeId,
        employee: employeeWhere,
        roleAssignments: { some: assignmentWhere },
      },
      select: { id: true },
    });

    return Boolean(user);
  }

  private async findEmployeeWithSystemRoles(
    db: PrismaTx | PrismaService,
    companyId: string,
    roleCodes: string[],
    excludeEmployeeId: string,
  ): Promise<string | null> {
    const user = await db.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        employeeId: { not: null },
        employee: {
          companyId,
          isActive: true,
          id: { not: excludeEmployeeId },
        },
        roleAssignments: {
          some: {
            isActive: true,
            role: {
              isActive: true,
              code: { in: roleCodes },
            },
          },
        },
      },
      select: { employeeId: true },
      orderBy: { createdAt: 'asc' },
    });

    return user?.employeeId ?? null;
  }
}
