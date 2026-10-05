import { Injectable } from '@nestjs/common';
import {
  ProjectActionEntityType,
  ProjectTaskParticipantStatus,
  ProjectTaskStatus,
  Prisma,
  TaskReviewDecision,
  TaskSubmissionStatus,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type { ProjectCommandDto } from '../dto/project-command.dto';
import type {
  AssignProjectTaskDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
} from '../dto/project-task.dto';
import { resolveUniqueProjectCode } from '../lib/project-code';
import { canTransitionTask } from '../policies/project-transitions';
import { detectParentCycle } from '../policies/task-parent-cycle';
import type {
  ProjectTaskView,
  ProjectsActorContext,
} from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import {
  PROJECT_NOTIFICATION_EVENT,
  ProjectNotificationService,
  type ProjectNotificationEvent,
} from './project-notification.service';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectsQueryService } from './projects-query.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class ProjectTaskCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ProjectCommandReceiptService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly query: ProjectsQueryService,
    private readonly notifications: ProjectNotificationService,
  ) {}

  async create(
    projectId: string,
    dto: CreateProjectTaskDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectTaskView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TASK_CREATE',
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const stage = await tx.projectStage.findFirst({
          where: {
            id: dto.stageId,
            projectId,
            companyId: project.companyId,
          },
        });
        if (!stage) {
          throw new DomainNotFoundException(
            PROJECTS_ERROR_CODES.PROJECT_STAGE_NOT_FOUND,
            'Project stage not found',
          );
        }

        if (dto.parentTaskId) {
          await this.assertValidParent(
            tx,
            project.companyId,
            projectId,
            dto.parentTaskId,
            null,
          );
        }

        let taskCode: string;
        try {
          taskCode = await resolveUniqueProjectCode({
            requestedCode: dto.taskCode,
            displayName: dto.taskName,
            fallback: 'TASK',
            exists: async (candidate) =>
              Boolean(
                await tx.projectTask.findFirst({
                  where: { projectId, taskCode: candidate },
                  select: { id: true },
                }),
              ),
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message === 'CODE_EXISTS'
              ? 'Task code already exists on this project.'
              : 'Unable to generate a unique task code.';
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            message,
          );
        }

        const created = await tx.projectTask.create({
          data: {
            companyId: project.companyId,
            projectId,
            stageId: dto.stageId,
            taskCode,
            taskName: dto.taskName.trim(),
            description: dto.description?.trim(),
            parentTaskId: dto.parentTaskId ?? null,
            priority: dto.priority?.trim() || 'MEDIUM',
            plannedHours: dto.plannedHours
              ? new Prisma.Decimal(dto.plannedHours)
              : new Prisma.Decimal(0),
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: 'OPEN',
            statusV2: ProjectTaskStatus.OPEN,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
        });

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.TASK,
            entityId: created.id,
            projectId,
            fromState: null,
            toState: ProjectTaskStatus.OPEN,
            actorUserId: actor.userId,
            versionBefore: null,
            versionAfter: created.version,
            operationId: dto.operationId,
          },
        });

        const view = this.query.toTaskView(
          created,
          currentProject.statusV2,
          currentProject.projectManagerId,
          [],
          actor,
        );
        return {
          entityType: 'TASK',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async update(
    projectId: string,
    taskId: string,
    dto: UpdateProjectTaskDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectTaskView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TASK_UPDATE',
      operationId: dto.operationId,
      requestPayload: { projectId, taskId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const task = await this.requireTask(
          tx,
          project.companyId,
          projectId,
          taskId,
        );
        if (
          task.statusV2 === ProjectTaskStatus.COMPLETED ||
          task.statusV2 === ProjectTaskStatus.CANCELLED
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Terminal tasks cannot be edited.',
          );
        }

        if (dto.parentTaskId !== undefined && dto.parentTaskId !== null) {
          await this.assertValidParent(
            tx,
            project.companyId,
            projectId,
            dto.parentTaskId,
            taskId,
          );
        }

        const updated = await this.casUpdateTask(
          tx,
          taskId,
          dto.expectedVersion,
          {
            taskName: dto.taskName?.trim(),
            description:
              dto.description === undefined ? undefined : dto.description,
            parentTaskId:
              dto.parentTaskId === undefined ? undefined : dto.parentTaskId,
            priority: dto.priority?.trim(),
            plannedHours:
              dto.plannedHours === undefined
                ? undefined
                : dto.plannedHours
                  ? new Prisma.Decimal(dto.plannedHours)
                  : null,
            startDate:
              dto.startDate === undefined
                ? undefined
                : dto.startDate
                  ? new Date(dto.startDate)
                  : null,
            dueDate:
              dto.dueDate === undefined
                ? undefined
                : dto.dueDate
                  ? new Date(dto.dueDate)
                  : null,
            updatedBy: actor.userId,
          },
        );

        const participants = await this.activeParticipantIds(tx, taskId);
        const view = this.query.toTaskView(
          updated,
          currentProject.statusV2,
          currentProject.projectManagerId,
          participants,
          actor,
        );
        return {
          entityType: 'TASK',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  assign(
    projectId: string,
    taskId: string,
    dto: AssignProjectTaskDto,
    actor: ProjectsActorContext,
  ) {
    return this.mutateAssignment(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_ASSIGN',
      mode: 'assign',
    });
  }

  reassign(
    projectId: string,
    taskId: string,
    dto: AssignProjectTaskDto,
    actor: ProjectsActorContext,
  ) {
    return this.mutateAssignment(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_REASSIGN',
      mode: 'reassign',
    });
  }

  async unassign(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto & { employeeId?: string },
    actor: ProjectsActorContext,
  ): Promise<ProjectTaskView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TASK_UNASSIGN',
      operationId: dto.operationId,
      requestPayload: { projectId, taskId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);

        const task = await this.requireTask(
          tx,
          project.companyId,
          projectId,
          taskId,
        );
        this.assertTaskVersion(task.version, dto.expectedVersion);
        if (
          task.statusV2 !== ProjectTaskStatus.OPEN &&
          task.statusV2 !== ProjectTaskStatus.ASSIGNED
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Only work that has not started may be unassigned. Reassign in-progress work directly.',
          );
        }

        const active = await tx.taskParticipant.findMany({
          where: { taskId, statusV2: ProjectTaskParticipantStatus.ACTIVE },
        });
        if (active.length === 0) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Task has no active participants.',
          );
        }

        const targets = dto.employeeId
          ? active.filter((p) => p.employeeId === dto.employeeId)
          : active;
        if (targets.length === 0) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_MEMBER_REQUIRED,
            'Specified participant is not active on this task.',
          );
        }

        const now = new Date();
        for (const participant of targets) {
          await tx.taskParticipant.update({
            where: { id: participant.id },
            data: {
              statusV2: ProjectTaskParticipantStatus.ENDED,
              status: 'ENDED',
              endedAt: now,
              endedByUserId: actor.userId,
              endReason: dto.reason ?? null,
              version: { increment: 1 },
            },
          });
          await tx.taskAssignmentHistory.create({
            data: {
              companyId: project.companyId,
              projectId,
              taskId,
              employeeId: participant.employeeId,
              role: participant.role,
              action: 'UNASSIGNED',
              remarks: dto.reason,
              actorUserId: actor.userId,
              operationId: dto.operationId,
            },
          });
        }

        const remaining = await this.activeParticipantIds(tx, taskId);
        let nextStatus: ProjectTaskStatus =
          task.statusV2 ?? ProjectTaskStatus.OPEN;
        if (
          remaining.length === 0 &&
          (nextStatus === ProjectTaskStatus.ASSIGNED ||
            nextStatus === ProjectTaskStatus.OPEN)
        ) {
          nextStatus = ProjectTaskStatus.OPEN;
        }

        const updated = await this.casUpdateTask(
          tx,
          taskId,
          dto.expectedVersion,
          {
            statusV2: nextStatus,
            status: String(nextStatus),
            updatedBy: actor.userId,
          },
        );

        const view = this.query.toTaskView(
          updated,
          currentProject.statusV2,
          currentProject.projectManagerId,
          remaining,
          actor,
        );
        return {
          entityType: 'TASK',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  start(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.taskLifecycle(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_START',
      toStatus: ProjectTaskStatus.IN_PROGRESS,
      requireAssignee: true,
      patch: () => ({ status: 'IN_PROGRESS' }),
    });
  }

  submitReview(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.taskLifecycle(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_SUBMIT_REVIEW',
      toStatus: ProjectTaskStatus.WAITING_REVIEW,
      requireAssignee: true,
      patch: (now, userId) => ({
        status: 'WAITING_REVIEW',
        submittedForReviewAt: now,
        submittedForReviewByUserId: userId,
      }),
      after: async (tx, ctx) => {
        if (!actor.employeeId) {
          return;
        }
        const latest = await tx.taskSubmission.findFirst({
          where: {
            taskId,
            companyId: ctx.companyId,
            projectId,
          },
          orderBy: { versionNo: 'desc' },
          select: { versionNo: true },
        });
        const versionNo = (latest?.versionNo ?? 0) + 1;
        const submission = await tx.taskSubmission.create({
          data: {
            companyId: ctx.companyId,
            projectId,
            taskId,
            versionNo,
            submissionNotes: dto.reason ?? null,
            submittedById: actor.employeeId,
            submittedByUserId: actor.userId,
            status: 'SUBMITTED',
            statusV2: TaskSubmissionStatus.SUBMITTED,
            submittedAt: ctx.now,
          },
        });
        await tx.projectDocument.updateMany({
          where: {
            companyId: ctx.companyId,
            projectId,
            taskId,
            taskSubmissionId: null,
            uploadedByUserId: actor.userId,
          },
          data: { taskSubmissionId: submission.id },
        });
      },
    });
  }

  returnTask(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.taskLifecycle(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_RETURN',
      toStatus: ProjectTaskStatus.IN_PROGRESS,
      requirePm: true,
      requiresReason: true,
      patch: (now, userId, reason) => ({
        status: 'IN_PROGRESS',
        returnedAt: now,
        returnedByUserId: userId,
        returnReason: reason ?? null,
      }),
      after: async (tx, ctx) => {
        await this.recordReviewRound(tx, {
          companyId: ctx.companyId,
          projectId,
          taskId,
          actor,
          decision: TaskReviewDecision.RETURN,
          comments: dto.reason,
          now: ctx.now,
        });
      },
    });
  }

  complete(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.taskLifecycle(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_COMPLETE',
      toStatus: ProjectTaskStatus.COMPLETED,
      requirePm: true,
      patch: (now, userId) => ({
        status: 'COMPLETED',
        completedAt: now,
        completedByUserId: userId,
        completionPercentage: new Prisma.Decimal(100),
      }),
      after: async (tx, ctx) => {
        await this.recordReviewRound(tx, {
          companyId: ctx.companyId,
          projectId,
          taskId,
          actor,
          decision: TaskReviewDecision.COMPLETE,
          comments: dto.reason,
          now: ctx.now,
        });
      },
    });
  }

  cancel(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.taskLifecycle(projectId, taskId, dto, actor, {
      commandType: 'PROJECT_TASK_CANCEL',
      toStatus: ProjectTaskStatus.CANCELLED,
      requirePm: true,
      requiresReason: true,
      patch: (now, userId, reason) => ({
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledByUserId: userId,
        cancellationReason: reason ?? null,
      }),
    });
  }

  private async mutateAssignment(
    projectId: string,
    taskId: string,
    dto: AssignProjectTaskDto,
    actor: ProjectsActorContext,
    options: { commandType: string; mode: 'assign' | 'reassign' },
  ): Promise<ProjectTaskView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: options.commandType,
      operationId: dto.operationId,
      requestPayload: { projectId, taskId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        // Assign/unassign/reassign are configuration for DRAFT and PM work for ACTIVE.
        // Must allow DRAFT so setup can assign before activation (matches UI allowedActions).
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const reason = dto.reason?.trim();
        if (options.mode === 'reassign' && !reason) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_REASON_REQUIRED,
            'A reason is required to reassign a task.',
          );
        }

        const task = await this.requireTask(
          tx,
          project.companyId,
          projectId,
          taskId,
        );
        this.assertTaskVersion(task.version, dto.expectedVersion);

        if (options.mode === 'assign') {
          if (
            task.statusV2 !== ProjectTaskStatus.OPEN &&
            task.statusV2 !== ProjectTaskStatus.ASSIGNED
          ) {
            throw new DomainConflictException(
              PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
              'Task cannot accept new assignments in the current state.',
            );
          }
        } else if (
          task.statusV2 !== ProjectTaskStatus.ASSIGNED &&
          task.statusV2 !== ProjectTaskStatus.IN_PROGRESS
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Task cannot be reassigned in the current state.',
          );
        }

        await this.assertActiveTeamMember(
          tx,
          project.companyId,
          projectId,
          dto.employeeId,
        );

        const now = new Date();
        let previousEmployeeId: string | null = null;

        if (options.mode === 'reassign') {
          const current = await tx.taskParticipant.findMany({
            where: { taskId, statusV2: ProjectTaskParticipantStatus.ACTIVE },
          });
          for (const participant of current) {
            previousEmployeeId = participant.employeeId;
            await tx.taskParticipant.update({
              where: { id: participant.id },
              data: {
                statusV2: ProjectTaskParticipantStatus.ENDED,
                status: 'ENDED',
                endedAt: now,
                endedByUserId: actor.userId,
                endReason: reason,
                version: { increment: 1 },
              },
            });
          }
        }

        const alreadyActive = await tx.taskParticipant.findFirst({
          where: {
            taskId,
            employeeId: dto.employeeId,
            statusV2: ProjectTaskParticipantStatus.ACTIVE,
          },
        });
        if (alreadyActive) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Employee is already an active participant.',
          );
        }

        await tx.taskParticipant.create({
          data: {
            companyId: project.companyId,
            projectId,
            taskId,
            employeeId: dto.employeeId,
            role: dto.role.trim(),
            plannedHours: dto.plannedHours
              ? new Prisma.Decimal(dto.plannedHours)
              : new Prisma.Decimal(0),
            status: 'ACTIVE',
            statusV2: ProjectTaskParticipantStatus.ACTIVE,
            assignedByUserId: actor.userId,
            assignedAt: now,
          },
        });

        await tx.taskAssignmentHistory.create({
          data: {
            companyId: project.companyId,
            projectId,
            taskId,
            employeeId: dto.employeeId,
            role: dto.role.trim(),
            action: options.mode === 'assign' ? 'ASSIGNED' : 'REASSIGNED',
            previousEmployeeId,
            remarks: reason,
            actorUserId: actor.userId,
            operationId: dto.operationId,
          },
        });

        const nextStatus =
          task.statusV2 === ProjectTaskStatus.OPEN
            ? ProjectTaskStatus.ASSIGNED
            : task.statusV2;

        const updated = await this.casUpdateTask(
          tx,
          taskId,
          dto.expectedVersion,
          {
            statusV2: nextStatus,
            status: nextStatus,
            updatedBy: actor.userId,
          },
        );

        const assigneeUserId = await this.notifications.resolveEmployeeUserId(
          tx,
          dto.employeeId,
        );
        await this.notifications.enqueue(tx, {
          eventType:
            options.mode === 'assign'
              ? PROJECT_NOTIFICATION_EVENT.TASK_ASSIGNED
              : PROJECT_NOTIFICATION_EVENT.TASK_REASSIGNED,
          aggregateType: 'TASK',
          aggregateId: taskId,
          companyId: project.companyId,
          branchId: currentProject.branchId,
          projectId,
          taskId,
          employeeId: dto.employeeId,
          status: String(nextStatus),
          version: updated.version,
          recipientUserIds: [assigneeUserId].filter((id): id is string =>
            Boolean(id),
          ),
          dedupeKey: `projects.task.${options.mode}:${taskId}:${updated.version}`,
        });

        const participants = await this.activeParticipantIds(tx, taskId);
        const view = this.query.toTaskView(
          updated,
          currentProject.statusV2,
          currentProject.projectManagerId,
          participants,
          actor,
        );
        return {
          entityType: 'TASK',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private async taskLifecycle(
    projectId: string,
    taskId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
    options: {
      commandType: string;
      toStatus: ProjectTaskStatus;
      requireAssignee?: boolean;
      requirePm?: boolean;
      requiresReason?: boolean;
      patch: (
        now: Date,
        userId: string,
        reason?: string,
      ) => Prisma.ProjectTaskUncheckedUpdateManyInput;
      after?: (
        tx: DbClient,
        ctx: { companyId: string; now: Date },
      ) => Promise<void>;
    },
  ): Promise<ProjectTaskView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: options.commandType,
      operationId: dto.operationId,
      requestPayload: { projectId, taskId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertActiveWorkAuthority(
          currentProject,
          actor,
          Boolean(options.requirePm),
        );
        const task = await this.requireTask(
          tx,
          project.companyId,
          projectId,
          taskId,
        );
        this.assertTaskVersion(task.version, dto.expectedVersion);

        if (
          !canTransitionTask(
            task.statusV2 ?? ProjectTaskStatus.OPEN,
            options.toStatus,
          )
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            `Cannot transition task from ${task.statusV2} to ${options.toStatus}.`,
          );
        }

        const reason = dto.reason?.trim();
        if (options.requiresReason && !reason) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_REASON_REQUIRED,
            'A reason is required for this action.',
          );
        }

        if (options.requireAssignee) {
          if (!actor.employeeId) {
            throw new DomainConflictException(
              PROJECTS_ERROR_CODES.TASK_NOT_ASSIGNED_TO_ACTOR,
              'Actor is not assigned to this task.',
            );
          }
          const mine = await tx.taskParticipant.findFirst({
            where: {
              taskId,
              employeeId: actor.employeeId,
              statusV2: ProjectTaskParticipantStatus.ACTIVE,
            },
          });
          if (!mine) {
            throw new DomainConflictException(
              PROJECTS_ERROR_CODES.TASK_NOT_ASSIGNED_TO_ACTOR,
              'Actor is not assigned to this task.',
            );
          }
        }

        const now = new Date();
        const result = await tx.projectTask.updateMany({
          where: { id: taskId, version: dto.expectedVersion },
          data: {
            ...options.patch(now, actor.userId, reason),
            statusV2: options.toStatus,
            version: { increment: 1 },
            updatedBy: actor.userId,
          },
        });
        if (result.count !== 1) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
            'Task version changed. Reload and retry.',
          );
        }

        const updated = await tx.projectTask.findUniqueOrThrow({
          where: { id: taskId },
        });

        if (options.after) {
          await options.after(tx, {
            companyId: project.companyId,
            now,
          });
        }

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.TASK,
            entityId: taskId,
            projectId,
            fromState: task.statusV2,
            toState: options.toStatus,
            actorUserId: actor.userId,
            versionBefore: task.version,
            versionAfter: updated.version,
            operationId: dto.operationId,
            protectedReason: reason,
          },
        });

        const notifyMap: Partial<Record<string, ProjectNotificationEvent>> = {
          PROJECT_TASK_SUBMIT_REVIEW: PROJECT_NOTIFICATION_EVENT.TASK_SUBMITTED,
          PROJECT_TASK_RETURN: PROJECT_NOTIFICATION_EVENT.TASK_RETURNED,
          PROJECT_TASK_COMPLETE: PROJECT_NOTIFICATION_EVENT.TASK_COMPLETED,
        };
        const notifyType = notifyMap[options.commandType];
        if (notifyType) {
          const participantsForNotify = await this.activeParticipantIds(
            tx,
            taskId,
          );
          const recipientUserIds: string[] = [];
          for (const employeeId of participantsForNotify) {
            const userId = await this.notifications.resolveEmployeeUserId(
              tx,
              employeeId,
            );
            if (userId) {
              recipientUserIds.push(userId);
            }
          }
          const managerUserId = await this.notifications.resolveManagerUserId(
            tx,
            currentProject.projectManagerId,
          );
          if (managerUserId) {
            recipientUserIds.push(managerUserId);
          }
          await this.notifications.enqueue(tx, {
            eventType: notifyType,
            aggregateType: 'TASK',
            aggregateId: taskId,
            companyId: project.companyId,
            branchId: currentProject.branchId,
            projectId,
            taskId,
            status: options.toStatus,
            version: updated.version,
            recipientUserIds,
            dedupeKey: `${notifyType}:${taskId}:${updated.version}`,
          });
        }

        const participants = await this.activeParticipantIds(tx, taskId);
        const view = this.query.toTaskView(
          updated,
          currentProject.statusV2,
          currentProject.projectManagerId,
          participants,
          actor,
        );
        return {
          entityType: 'TASK',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private async requireTask(
    tx: DbClient,
    companyId: string,
    projectId: string,
    taskId: string,
  ) {
    const task = await tx.projectTask.findFirst({
      where: { id: taskId, projectId, companyId },
    });
    if (!task) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_NOT_FOUND,
        'Project task not found',
      );
    }
    return task;
  }

  private assertTaskVersion(actual: number, expected: number) {
    if (actual !== expected) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
        'Task version changed. Reload and retry.',
      );
    }
  }

  private async activeParticipantIds(tx: DbClient, taskId: string) {
    const rows = await tx.taskParticipant.findMany({
      where: { taskId, statusV2: ProjectTaskParticipantStatus.ACTIVE },
      select: { employeeId: true },
    });
    return rows.map((row) => row.employeeId);
  }

  private async assertActiveTeamMember(
    tx: DbClient,
    companyId: string,
    projectId: string,
    employeeId: string,
  ) {
    const member = await tx.projectTeamMember.findFirst({
      where: {
        companyId,
        projectId,
        employeeId,
        statusV2: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!member) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_MEMBER_REQUIRED,
        'Assignee must be an active project team member.',
      );
    }
  }

  private async assertValidParent(
    tx: DbClient,
    companyId: string,
    projectId: string,
    parentTaskId: string,
    selfTaskId: string | null,
  ) {
    if (selfTaskId && parentTaskId === selfTaskId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_PARENT_CYCLE,
        'A task cannot be its own parent.',
      );
    }

    const parent = await tx.projectTask.findFirst({
      where: { id: parentTaskId, projectId, companyId },
      select: { id: true, parentTaskId: true },
    });
    if (!parent) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_NOT_FOUND,
        'Parent task not found',
      );
    }

    const parentById = new Map<string, string | null>([
      [parent.id, parent.parentTaskId],
    ]);
    let cursor = parent.parentTaskId;
    while (cursor) {
      if (parentById.has(cursor)) {
        break;
      }
      const next = await tx.projectTask.findFirst({
        where: { id: cursor, projectId, companyId },
        select: { id: true, parentTaskId: true },
      });
      if (!next) {
        break;
      }
      parentById.set(next.id, next.parentTaskId);
      cursor = next.parentTaskId;
    }

    const reason = detectParentCycle({
      selfTaskId,
      proposedParentId: parentTaskId,
      parentById,
    });
    if (reason === 'SELF') {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_PARENT_CYCLE,
        'A task cannot be its own parent.',
      );
    }
    if (reason === 'CYCLE') {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_PARENT_CYCLE,
        'Parent assignment would create a cycle.',
      );
    }
  }

  private async recordReviewRound(
    tx: DbClient,
    input: {
      companyId: string;
      projectId: string;
      taskId: string;
      actor: ProjectsActorContext;
      decision: TaskReviewDecision;
      comments?: string;
      now: Date;
    },
  ) {
    if (!input.actor.employeeId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
        'Only the Project Manager may review submissions.',
      );
    }

    const submission = await tx.taskSubmission.findFirst({
      where: {
        taskId: input.taskId,
        companyId: input.companyId,
        projectId: input.projectId,
        statusV2: TaskSubmissionStatus.SUBMITTED,
      },
      orderBy: { versionNo: 'desc' },
    });
    if (!submission) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
        'No open submission exists for this review decision.',
      );
    }

    const priorReviews = await tx.taskReview.count({
      where: { submissionId: submission.id },
    });

    await tx.taskReview.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        taskId: input.taskId,
        submissionId: submission.id,
        reviewerId: input.actor.employeeId,
        reviewerUserId: input.actor.userId,
        decision: input.decision,
        decisionV2: input.decision,
        comments: input.comments ?? null,
        reviewRound: priorReviews + 1,
        reviewedAt: input.now,
      },
    });

    await tx.taskSubmission.update({
      where: { id: submission.id },
      data: {
        status:
          input.decision === TaskReviewDecision.COMPLETE
            ? 'ACCEPTED'
            : input.decision === TaskReviewDecision.RETURN
              ? 'RETURNED'
              : 'CANCELLED',
        statusV2:
          input.decision === TaskReviewDecision.COMPLETE
            ? TaskSubmissionStatus.ACCEPTED
            : input.decision === TaskReviewDecision.RETURN
              ? TaskSubmissionStatus.RETURNED
              : TaskSubmissionStatus.CANCELLED,
        version: { increment: 1 },
      },
    });
  }

  private async casUpdateTask(
    tx: DbClient,
    taskId: string,
    expectedVersion: number,
    data: Prisma.ProjectTaskUncheckedUpdateManyInput,
  ) {
    const result = await tx.projectTask.updateMany({
      where: { id: taskId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TASK_STATE_CHANGED,
        'Task version changed. Reload and retry.',
      );
    }
    return tx.projectTask.findUniqueOrThrow({ where: { id: taskId } });
  }
}
