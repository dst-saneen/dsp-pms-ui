import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OnboardingActionAuthorityMode,
  OnboardingTaskActionType,
  Prisma,
  TaskStatus,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { SortOrder } from '../../../common/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import type {
  OnboardingAssigneeCandidateResponse,
  OnboardingAssetCandidateResponse,
  EmployeeOnboardingTaskAllowedAction,
  OnboardingTaskHistoryItemResponse,
  OnboardingWorkspaceCapabilitiesResponse,
  PagedResult,
  ReopenOnboardingTaskPreflightResponse,
  EmployeeOnboardingTaskRuntimeView,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';
import {
  ONBOARDING_PERMISSIONS,
  hasOnboardingPermission,
} from '../constants/onboarding-permissions';
import {
  AssignOnboardingTaskDto,
  CompleteOnboardingTaskCommandDto,
  FulfillOnboardingAssetTaskDto,
  ReopenOnboardingTaskCommandDto,
  SkipOnboardingTaskCommandDto,
  StartOnboardingTaskCommandDto,
  UnassignOnboardingTaskDto,
  WaiveOnboardingTaskDto,
} from '../dto/task-command.dto';
import {
  DepartmentQueueAssignmentState,
  AssetCandidatesQueryDto,
  DepartmentQueueQueryDto,
  MyOnboardingTasksQueryDto,
  TaskHistoryQueryDto,
} from '../dto/task-query.dto';
import { OnboardingResponseMapper } from '../mappers/onboarding-response.mapper';
import { OnboardingActorContextService } from './onboarding-actor-context.service';
import { OnboardingAssetFulfillmentService } from './onboarding-asset-fulfillment.service';
import { OnboardingCapabilityService } from './onboarding-capability.service';
import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';
import {
  OnboardingNotificationEventCode,
  OnboardingNotificationService,
} from './onboarding-notification.service';
import { OnboardingScopeService } from './onboarding-scope.service';
import { OnboardingTransactionRunnerService } from './onboarding-transaction-runner.service';

const runtimeTaskInclude = {
  assignedToUser: {
    select: {
      id: true,
      displayName: true,
      employee: { select: { id: true, employeeCode: true } },
    },
  },
  assignedByUser: { select: { id: true, displayName: true } },
  assignedDepartment: true,
  executorDepartment: true,
  dependsOnTask: {
    select: { id: true, taskName: true, status: true, statusV2: true },
  },
} satisfies Prisma.EmployeeOnboardingTaskInclude;

@Injectable()
export class EmployeeOnboardingTaskRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly onboardingScope: OnboardingScopeService,
    private readonly actorContext: OnboardingActorContextService,
    private readonly featureGate: OnboardingFeatureGateService,
    private readonly capabilityService: OnboardingCapabilityService,
    private readonly mapper: OnboardingResponseMapper,
    private readonly transactionRunner: OnboardingTransactionRunnerService,
    private readonly assetFulfillment: OnboardingAssetFulfillmentService,
    private readonly notificationService: OnboardingNotificationService,
  ) {}

  async workspaceCapabilities(
    user: AuthenticatedUser,
  ): Promise<OnboardingWorkspaceCapabilitiesResponse> {
    await this.featureGate.assertEnabledForContext();

    const actor = await this.actorContext.resolve(user);
    const sections: OnboardingWorkspaceCapabilitiesResponse['sections'] = [];

    if (hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.SELF_READ)) {
      sections.push('MY_TASKS');
    }

    if (this.canOpenDepartmentQueue(actor)) {
      sections.push('DEPARTMENT_QUEUE');
    }

    return { sections };
  }

  async myTasks(
    user: AuthenticatedUser,
    query: MyOnboardingTasksQueryDto,
  ): Promise<PagedResult<EmployeeOnboardingTaskRuntimeView>> {
    await this.featureGate.assertEnabledForContext();

    const actor = await this.actorContext.resolve(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.EmployeeOnboardingTaskWhereInput = {
      assignedToUserId: actor.userId,
      onboarding: this.scopeService.onboardingWhere(),
      ...(query.status ? { statusV2: query.status as never } : {}),
      ...(query.workType ? { workType: query.workType as never } : {}),
      ...(query.ownerType ? { ownerType: query.ownerType as never } : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.employeeOnboardingTask.findMany({
        where,
        include: {
          onboarding: {
            include: {
              employee: {
                include: {
                  department: true,
                  designation: true,
                  branch: { include: { company: true } },
                },
              },
              template: true,
              templateVersion: true,
            },
          },
          assignedToUser: {
            select: {
              id: true,
              displayName: true,
              employee: { select: { id: true, employeeCode: true } },
            },
          },
          assignedByUser: { select: { id: true, displayName: true } },
          assignedDepartment: true,
          executorDepartment: true,
          dependsOnTask: {
            select: { id: true, taskName: true, status: true, statusV2: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { dueDate: 'asc' },
          { priority: 'desc' },
          { sequenceNo: 'asc' },
        ],
      }),
      this.prisma.employeeOnboardingTask.count({ where }),
    ]);

    const onboardingRecords = await Promise.all(
      tasks.map((task) =>
        this.onboardingScope.loadOnboarding(task.onboardingId),
      ),
    );

    const onboardingById = new Map(
      onboardingRecords.map((record) => [record.id, record]),
    );

    return {
      items: tasks.map((task) =>
        this.mapper.mapTask(
          task as never,
          onboardingById.get(task.onboardingId)!,
          actor,
        ),
      ),
      total,
      page,
      limit,
    };
  }

  async departmentQueue(
    user: AuthenticatedUser,
    query: DepartmentQueueQueryDto,
  ): Promise<PagedResult<EmployeeOnboardingTaskRuntimeView>> {
    await this.featureGate.assertEnabledForContext();

    const actor = await this.actorContext.resolve(user);
    const privileged = this.isPrivilegedDepartmentMonitor(actor);

    if (!this.canOpenDepartmentQueue(actor)) {
      throw new NotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const assignmentState =
      query.assignmentState ?? DepartmentQueueAssignmentState.ALL;

    const where: Prisma.EmployeeOnboardingTaskWhereInput = {
      ownerType: 'DEPARTMENT',
      onboarding: this.scopeService.onboardingWhere(),
      ...(privileged
        ? {}
        : {
            executorDepartmentId: actor.employeeContext!.departmentId,
          }),
      ...(assignmentState === DepartmentQueueAssignmentState.UNASSIGNED
        ? { assignedToUserId: null }
        : assignmentState === DepartmentQueueAssignmentState.ASSIGNED
          ? { assignedToUserId: { not: null } }
          : {}),
      ...(query.workType ? { workType: query.workType as never } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.keyword
        ? {
            OR: [
              { taskName: { contains: query.keyword, mode: 'insensitive' } },
              {
                onboarding: {
                  employee: {
                    OR: [
                      {
                        employeeCode: {
                          contains: query.keyword,
                          mode: 'insensitive',
                        },
                      },
                      {
                        firstName: {
                          contains: query.keyword,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: {
                          contains: query.keyword,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.employeeOnboardingTask.findMany({
        where,
        include: {
          assignedToUser: {
            select: {
              id: true,
              displayName: true,
              employee: { select: { id: true, employeeCode: true } },
            },
          },
          assignedByUser: { select: { id: true, displayName: true } },
          assignedDepartment: true,
          executorDepartment: true,
          dependsOnTask: {
            select: { id: true, taskName: true, status: true, statusV2: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { sequenceNo: 'asc' }],
      }),
      this.prisma.employeeOnboardingTask.count({ where }),
    ]);

    const items: EmployeeOnboardingTaskRuntimeView[] = [];

    for (const task of tasks) {
      const onboarding = await this.onboardingScope.loadOnboarding(
        task.onboardingId,
      );
      items.push(this.mapper.mapTask(task, onboarding, actor));
    }

    return { items, total, page, limit };
  }

  async getTask(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    const task = await this.loadRuntimeTask(taskId);
    this.assertTaskVisible(actor, task);
    const onboarding = await this.onboardingScope.loadOnboarding(
      task.onboardingId,
    );
    return this.mapper.mapTask(task, onboarding, actor);
  }

  async assigneeCandidates(
    user: AuthenticatedUser,
    taskId: string,
    query: { keyword?: string; page?: number; limit?: number },
  ): Promise<OnboardingAssigneeCandidateResponse> {
    const actor = await this.actorContext.resolve(user);
    const task = await this.loadRuntimeTask(taskId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const departmentId = task.executorDepartmentId ?? task.assignedDepartmentId;
    const privileged = this.isPrivilegedDepartmentMonitor(actor);
    const inExecutorDepartment =
      Boolean(departmentId) &&
      actor.employeeContext?.departmentId === departmentId &&
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN);

    if (!departmentId || (!privileged && !inExecutorDepartment)) {
      throw new NotFoundException();
    }

    const where: Prisma.EmployeeWhereInput = {
      departmentId,
      branchId: task.branchId ?? undefined,
      companyId: task.companyId ?? undefined,
      isActive: true,
      user: { isNot: null },
      ...(query.keyword
        ? {
            OR: [
              {
                employeeCode: { contains: query.keyword, mode: 'insensitive' },
              },
              { firstName: { contains: query.keyword, mode: 'insensitive' } },
              { lastName: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          branch: true,
          designation: true,
          user: { select: { id: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { employeeCode: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: employees
        .filter((employee) => employee.user)
        .map((employee) => ({
          employeeId: employee.id,
          userId: employee.user!.id,
          employeeCode: employee.employeeCode,
          displayName:
            `${employee.firstName} ${employee.lastName ?? ''}`.trim(),
          isActive: true as const,
          designation: employee.designation
            ? {
                id: employee.designation.id,
                code: employee.designation.designationCode,
                name: employee.designation.designationName,
              }
            : null,
          department: {
            id: employee.department.id,
            code: employee.department.departmentCode,
            name: employee.department.departmentName,
          },
          branch: {
            id: employee.branch.id,
            code: employee.branch.branchCode,
            name: employee.branch.branchName,
          },
        })),
      total,
      page,
      limit,
    };
  }

  async getTaskHistory(
    user: AuthenticatedUser,
    taskId: string,
    query: TaskHistoryQueryDto,
  ): Promise<PagedResult<OnboardingTaskHistoryItemResponse>> {
    const actor = await this.actorContext.resolve(user);
    const task = await this.loadRuntimeTask(taskId);
    this.assertTaskVisible(actor, task);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder ?? 'DESC';

    const where = {
      taskId,
      companyId: task.companyId ?? undefined,
    };

    const [events, total] = await Promise.all([
      this.prisma.onboardingTaskActionEvent.findMany({
        where,
        orderBy: {
          createdAt: sortOrder === SortOrder.ASC ? 'asc' : 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.onboardingTaskActionEvent.count({ where }),
    ]);

    const userIds = new Set<string>();
    for (const event of events) {
      userIds.add(event.actorUserId);
      if (event.fromAssigneeUserId) {
        userIds.add(event.fromAssigneeUserId);
      }
      if (event.toAssigneeUserId) {
        userIds.add(event.toAssigneeUserId);
      }
    }

    const users = userIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: {
            id: true,
            displayName: true,
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        })
      : [];

    const userMap = new Map(
      users.map((entry) => [
        entry.id,
        entry.displayName ??
          `${entry.employee?.firstName ?? ''} ${entry.employee?.lastName ?? ''}`.trim(),
      ]),
    );

    const canSeeAllReasons = actor.permissions.includes(
      ONBOARDING_PERMISSIONS.OVERRIDE,
    );

    const items: OnboardingTaskHistoryItemResponse[] = events.map((event) => {
      const canSeeReason =
        canSeeAllReasons ||
        event.actorUserId === actor.userId ||
        event.fromAssigneeUserId === actor.userId ||
        event.toAssigneeUserId === actor.userId;

      return {
        id: event.id,
        action: event.action,
        authorityMode: event.authorityMode,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        fromAssignee: event.fromAssigneeUserId
          ? {
              userId: event.fromAssigneeUserId,
              displayName:
                userMap.get(event.fromAssigneeUserId) ??
                event.fromAssigneeUserId,
            }
          : null,
        toAssignee: event.toAssigneeUserId
          ? {
              userId: event.toAssigneeUserId,
              displayName:
                userMap.get(event.toAssigneeUserId) ?? event.toAssigneeUserId,
            }
          : null,
        actor: {
          userId: event.actorUserId,
          displayName: userMap.get(event.actorUserId) ?? event.actorUserId,
        },
        reason: canSeeReason ? event.reason : null,
        assetResult:
          event.resultType &&
          (event.employeeAssetId || event.softwareLicenseAllocationId)
            ? {
                attemptNo: event.assetAttemptNo ?? 1,
                resultType: event.resultType,
                resultId:
                  event.employeeAssetId ??
                  event.softwareLicenseAllocationId ??
                  '',
              }
            : null,
        taskVersionAfter: event.taskVersionAfter,
        createdAt: event.createdAt.toISOString(),
      };
    });

    return { items, total, page, limit };
  }

  async assign(
    user: AuthenticatedUser,
    taskId: string,
    dto: AssignOnboardingTaskDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      (task) => (task.assignedToUserId ? 'REASSIGN' : 'ASSIGN'),
      async (tx, task) => {
        const executorDepartmentId =
          task.executorDepartmentId ?? task.assignedDepartmentId;
        const assignee = await tx.employee.findFirst({
          where: {
            id: dto.assigneeEmployeeId,
            companyId: task.companyId ?? undefined,
            branchId: task.branchId ?? undefined,
            departmentId: executorDepartmentId ?? undefined,
            isActive: true,
          },
          include: { user: true },
        });

        if (!executorDepartmentId || !assignee?.user) {
          throw new DomainConflictException(
            ONBOARDING_ERROR_CODES.TASK_ASSIGNEE_OUT_OF_DEPARTMENT,
            'Assignee is not eligible.',
          );
        }

        if (task.assignedToUserId && !dto.reason?.trim()) {
          throw new DomainConflictException(
            ONBOARDING_ERROR_CODES.OVERRIDE_REASON_REQUIRED,
            'A reassignment reason is required.',
          );
        }

        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            assignedToUserId: assignee.user.id,
            assignedByUserId: user.id,
            assignedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: task.assignedToUserId
            ? OnboardingTaskActionType.REASSIGNED
            : OnboardingTaskActionType.ASSIGNED,
          fromAssigneeUserId: task.assignedToUserId,
          toAssigneeUserId: assignee.user.id,
          reason: dto.reason ?? null,
          operationId: dto.operationId,
        });
      },
    );
  }

  async unassign(
    user: AuthenticatedUser,
    taskId: string,
    dto: UnassignOnboardingTaskDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'UNASSIGN',
      async (tx, task) => {
        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            assignedToUserId: null,
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.UNASSIGNED,
          fromAssigneeUserId: task.assignedToUserId,
          toAssigneeUserId: null,
          reason: dto.reason,
          operationId: dto.operationId,
        });
      },
    );
  }

  async startTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: StartOnboardingTaskCommandDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'START',
      async (tx, task) => {
        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.IN_PROGRESS,
            statusV2: 'IN_PROGRESS',
            startedAt: new Date(),
            startedDate: new Date(),
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.STARTED,
          fromStatus: task.statusV2 ?? 'PENDING',
          toStatus: 'IN_PROGRESS',
          operationId: dto.operationId,
        });
      },
    );
  }

  async completeTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: CompleteOnboardingTaskCommandDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'COMPLETE',
      async (tx, task, actor) => {
        const usesOverride = task.assignedToUserId !== actor.userId;

        if (usesOverride && !dto.overrideReason?.trim()) {
          throw new DomainConflictException(
            ONBOARDING_ERROR_CODES.OVERRIDE_REASON_REQUIRED,
            'An override reason is required.',
          );
        }

        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.COMPLETED,
            statusV2: 'COMPLETED',
            resolvedAt: new Date(),
            completedDate: new Date(),
            completedByUserId: user.id,
            resolvedByUserId: user.id,
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: usesOverride
            ? OnboardingTaskActionType.OVERRIDE_COMPLETED
            : OnboardingTaskActionType.COMPLETED,
          fromStatus: task.statusV2 ?? task.status,
          toStatus: 'COMPLETED',
          reason: usesOverride
            ? (dto.overrideReason ?? null)
            : (dto.remarks ?? null),
          operationId: dto.operationId,
          authorityMode: usesOverride
            ? OnboardingActionAuthorityMode.HR_OVERRIDE
            : OnboardingActionAuthorityMode.NORMAL,
        });
      },
    );
  }

  async skipTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: SkipOnboardingTaskCommandDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'SKIP',
      async (tx, task) => {
        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.SKIPPED,
            statusV2: 'SKIPPED',
            resolvedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.SKIPPED,
          fromStatus: task.statusV2 ?? task.status,
          toStatus: 'SKIPPED',
          reason: dto.reason,
          operationId: dto.operationId,
        });
      },
    );
  }

  async waiveTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: WaiveOnboardingTaskDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'WAIVE',
      async (tx, task) => {
        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.SKIPPED,
            statusV2: 'WAIVED',
            resolvedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.WAIVED,
          fromStatus: task.statusV2 ?? task.status,
          toStatus: 'WAIVED',
          reason: dto.reason,
          operationId: dto.operationId,
          authorityMode: OnboardingActionAuthorityMode.HR_OVERRIDE,
        });
      },
    );
  }

  async reopenPreflight(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<ReopenOnboardingTaskPreflightResponse> {
    const actor = await this.actorContext.resolve(user);
    const task = await this.loadRuntimeTask(taskId);
    this.assertTaskVisible(actor, task);
    const onboarding = await this.onboardingScope.loadOnboarding(
      task.onboardingId,
    );
    const capabilities = this.capabilityService.calculateTaskActions(
      actor,
      { ...task, status: task.statusV2 ?? task.status },
      { ...onboarding, status: onboarding.statusV2 ?? onboarding.status },
    );
    const reopenCapabilities = capabilities.actionCapabilities.filter(
      (capability) => capability.action === 'REOPEN',
    );
    const canReopen = capabilities.allowedActions.includes('REOPEN');

    return {
      taskId: task.id,
      contractVersion: task.contractVersion ?? 'V2',
      expectedTaskVersion: task.version,
      canReopen,
      affectedTasks: [
        {
          taskId: task.id,
          taskName: task.taskName,
          role: 'TARGET',
          status: task.statusV2 ?? 'COMPLETED',
          expectedVersion: task.version,
          attemptNo: task.attemptNo,
        },
      ],
      blockedReasons: capabilities.blockedReasons,
      allowedActions: canReopen ? ['REOPEN'] : [],
      actionCapabilities: reopenCapabilities,
    };
  }

  async reopenTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: ReopenOnboardingTaskCommandDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'REOPEN',
      async (tx, task) => {
        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.PENDING,
            statusV2: 'PENDING',
            attemptNo: { increment: 1 },
            resolvedAt: null,
            completedDate: null,
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.REOPENED,
          fromStatus: task.statusV2 ?? task.status,
          toStatus: 'PENDING',
          reason: dto.reason,
          operationId: dto.operationId,
        });
      },
    );
  }

  async assetCandidates(
    user: AuthenticatedUser,
    taskId: string,
    query: AssetCandidatesQueryDto,
  ): Promise<OnboardingAssetCandidateResponse> {
    const actor = await this.actorContext.resolve(user);
    const task = await this.loadRuntimeTask(taskId);
    const onboarding = await this.onboardingScope.loadOnboarding(
      task.onboardingId,
    );
    const capabilities = this.capabilityService.calculateTaskActions(
      actor,
      {
        ...task,
        status: task.statusV2 ?? task.status,
      },
      {
        ...onboarding,
        status: onboarding.statusV2 ?? onboarding.status,
      },
    );

    if (!capabilities.allowedActions.includes('FULFILL_ASSET')) {
      throw new NotFoundException();
    }

    return this.assetFulfillment.candidates(user, task, query);
  }

  async fulfillAssetTask(
    user: AuthenticatedUser,
    taskId: string,
    dto: FulfillOnboardingAssetTaskDto,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    const currentTask = await this.loadRuntimeTask(taskId);
    const onboarding = await this.onboardingScope.loadOnboarding(
      currentTask.onboardingId,
    );
    const capabilities = this.capabilityService.calculateTaskActions(
      actor,
      {
        ...currentTask,
        status: currentTask.statusV2 ?? currentTask.status,
      },
      {
        ...onboarding,
        status: onboarding.statusV2 ?? onboarding.status,
      },
    );

    if (!capabilities.allowedActions.includes('FULFILL_ASSET')) {
      throw new NotFoundException();
    }

    return this.mutateTask(
      user,
      taskId,
      dto.expectedTaskVersion,
      'FULFILL_ASSET',
      async (tx, task) => {
        const result = await this.assetFulfillment.fulfillWithinTransaction(
          tx,
          user,
          task,
          dto,
        );

        await tx.employeeOnboardingTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.COMPLETED,
            statusV2: 'COMPLETED',
            resultType: result.resultType,
            employeeAssetId: result.employeeAssetId,
            softwareLicenseAllocationId: result.softwareLicenseAllocationId,
            resolvedAt: new Date(),
            completedDate: new Date(),
            completedByUserId: user.id,
            resolvedByUserId: user.id,
            remarks: dto.remarks?.trim() || null,
            version: { increment: 1 },
          },
        });

        await this.recordAction(tx, task, user.id, {
          action: OnboardingTaskActionType.COMPLETED,
          fromStatus: task.statusV2 ?? task.status,
          toStatus: 'COMPLETED',
          reason: dto.remarks?.trim() || null,
          operationId: dto.operationId,
          resultType: result.resultType,
          employeeAssetId: result.employeeAssetId,
          softwareLicenseAllocationId: result.softwareLicenseAllocationId,
          assetAttemptNo: task.attemptNo,
        });
      },
    );
  }

  private async loadRuntimeTask(taskId: string) {
    const task = await this.prisma.employeeOnboardingTask.findFirst({
      where: {
        id: taskId,
        onboarding: this.scopeService.onboardingWhere(),
      },
      include: runtimeTaskInclude,
    });

    if (!task) {
      throw new NotFoundException();
    }

    await this.featureGate.assertEnabledForContext(
      task.companyId ?? undefined,
      task.branchId ?? undefined,
    );

    return task;
  }

  private async mutateTask(
    user: AuthenticatedUser,
    taskId: string,
    expectedVersion: number,
    requiredAction:
      | EmployeeOnboardingTaskAllowedAction
      | ((
          task: Awaited<ReturnType<typeof this.loadRuntimeTask>>,
        ) => EmployeeOnboardingTaskAllowedAction),
    handler: (
      tx: Prisma.TransactionClient,
      task: Awaited<ReturnType<typeof this.loadRuntimeTask>>,
      actor: Awaited<ReturnType<OnboardingActorContextService['resolve']>>,
    ) => Promise<void>,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const actor = await this.actorContext.resolve(user);

    await this.transactionRunner.run(async (tx) => {
      const task = await tx.employeeOnboardingTask.findFirst({
        where: {
          id: taskId,
          onboarding: this.scopeService.onboardingWhere(),
        },
        include: runtimeTaskInclude,
      });

      if (!task) {
        throw new NotFoundException();
      }

      await this.featureGate.assertEnabledForContext(
        task.companyId ?? undefined,
        task.branchId ?? undefined,
      );

      this.assertTaskVisible(actor, task);

      const onboarding = await tx.employeeOnboarding.findFirst({
        where: {
          id: task.onboardingId,
          ...this.scopeService.onboardingWhere(),
        },
      });

      if (!onboarding) {
        throw new NotFoundException();
      }

      const action =
        typeof requiredAction === 'function'
          ? requiredAction(task)
          : requiredAction;
      const capabilities = this.capabilityService.calculateTaskActions(
        actor,
        { ...task, status: task.statusV2 ?? task.status },
        { ...onboarding, status: onboarding.statusV2 ?? onboarding.status },
      );

      if (!capabilities.allowedActions.includes(action)) {
        throw new NotFoundException();
      }

      if (task.version !== expectedVersion) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.TASK_STATE_CHANGED,
          'Task version changed.',
        );
      }

      await handler(tx, task, actor);
    });

    return this.getTask(user, taskId);
  }

  private assertTaskVisible(
    actor: Awaited<ReturnType<OnboardingActorContextService['resolve']>>,
    task: Awaited<ReturnType<typeof this.loadRuntimeTask>>,
  ): void {
    const canMonitor =
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.READ) ||
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.MANAGE) ||
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.OVERRIDE);
    const canSeeAssigned =
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.SELF_READ) &&
      task.assignedToUserId === actor.userId;
    const canSeeOwnOnboarding =
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.SELF_READ) &&
      task.employeeId === actor.employeeContext?.employeeId;
    const executorDepartmentId =
      task.executorDepartmentId ?? task.assignedDepartmentId;
    const canSeeDepartment =
      executorDepartmentId === actor.employeeContext?.departmentId &&
      (hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.DEPARTMENT_READ) ||
        hasOnboardingPermission(
          actor,
          ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN,
        ));

    if (
      !canMonitor &&
      !canSeeAssigned &&
      !canSeeOwnOnboarding &&
      !canSeeDepartment
    ) {
      throw new NotFoundException();
    }
  }

  private isPrivilegedDepartmentMonitor(
    actor: Awaited<ReturnType<OnboardingActorContextService['resolve']>>,
  ): boolean {
    return (
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.READ) ||
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.MANAGE) ||
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.OVERRIDE)
    );
  }

  private canOpenDepartmentQueue(
    actor: Awaited<ReturnType<OnboardingActorContextService['resolve']>>,
  ): boolean {
    if (this.isPrivilegedDepartmentMonitor(actor)) {
      return true;
    }

    return Boolean(
      actor.employeeContext &&
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.DEPARTMENT_READ),
    );
  }

  private async recordAction(
    tx: Prisma.TransactionClient,
    task: {
      id: string;
      onboardingId: string;
      companyId: string | null;
      branchId?: string | null;
      employeeId?: string | null;
      dueDate?: Date | null;
      version: number;
    },
    actorUserId: string,
    input: {
      action: OnboardingTaskActionType;
      fromStatus?: string;
      toStatus?: string;
      fromAssigneeUserId?: string | null;
      toAssigneeUserId?: string | null;
      reason?: string | null;
      operationId: string;
      authorityMode?: OnboardingActionAuthorityMode;
      resultType?: 'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION';
      employeeAssetId?: string | null;
      softwareLicenseAllocationId?: string | null;
      assetAttemptNo?: number;
    },
  ) {
    await tx.onboardingTaskActionEvent.create({
      data: {
        companyId: task.companyId ?? '',
        onboardingId: task.onboardingId,
        taskId: task.id,
        action: input.action,
        authorityMode:
          input.authorityMode ?? OnboardingActionAuthorityMode.NORMAL,
        fromStatus: input.fromStatus as never,
        toStatus: (input.toStatus ?? 'PENDING') as never,
        fromAssigneeUserId: input.fromAssigneeUserId,
        toAssigneeUserId: input.toAssigneeUserId,
        actorUserId,
        reason: input.reason,
        operationId: input.operationId,
        taskVersionBefore: task.version,
        taskVersionAfter: task.version + 1,
        resultType: input.resultType,
        employeeAssetId: input.employeeAssetId,
        softwareLicenseAllocationId: input.softwareLicenseAllocationId,
        assetAttemptNo: input.assetAttemptNo,
      },
    });

    const eventCode = this.mapActionToNotificationEvent(input.action);
    const recipientUserId =
      input.toAssigneeUserId ??
      input.fromAssigneeUserId ??
      (input.action === OnboardingTaskActionType.COMPLETED ||
      input.action === OnboardingTaskActionType.WAIVED
        ? actorUserId
        : null);

    if (eventCode && recipientUserId) {
      await this.notificationService.enqueueInTransaction(
        tx,
        {
          companyId: task.companyId,
          branchId: task.branchId,
          employeeId: task.employeeId,
          onboardingId: task.onboardingId,
          onboardingTaskId: task.id,
          recipientUserId,
          eventCode,
          status: input.toStatus ?? null,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
        `onboarding:${eventCode}:${task.id}:${input.operationId}:user:${recipientUserId}`,
      );
    }
  }

  private mapActionToNotificationEvent(
    action: OnboardingTaskActionType,
  ): OnboardingNotificationEventCode | null {
    switch (action) {
      case OnboardingTaskActionType.ASSIGNED:
        return 'ONBOARDING_TASK_ASSIGNED';
      case OnboardingTaskActionType.REASSIGNED:
        return 'ONBOARDING_TASK_REASSIGNED';
      case OnboardingTaskActionType.UNASSIGNED:
        return 'ONBOARDING_TASK_UNASSIGNED';
      case OnboardingTaskActionType.COMPLETED:
      case OnboardingTaskActionType.OVERRIDE_COMPLETED:
        return 'ONBOARDING_TASK_COMPLETED';
      case OnboardingTaskActionType.WAIVED:
        return 'ONBOARDING_TASK_WAIVED';
      default:
        return null;
    }
  }
}
