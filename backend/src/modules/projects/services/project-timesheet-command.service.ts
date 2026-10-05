import { Injectable } from '@nestjs/common';
import { ProjectActionEntityType, Prisma, WorkLogStatus } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type { ProjectCommandDto } from '../dto/project-command.dto';
import type {
  AddTimesheetLineDto,
  CreateTimesheetDto,
  UpdateTimesheetDto,
  UpdateTimesheetLineDto,
} from '../dto/timesheet.dto';
import {
  canTransitionWorkLog,
  isEditableWorkLogStatus,
} from '../policies/work-log-transitions';
import {
  exceedsDailyHoursCap,
  isValidLineHours,
  isXorTaskOrCategory,
} from '../policies/timesheet-hours';
import {
  isDateWithinInclusive,
  parseDateOnly,
  toUtcDateOnly,
} from '../policies/work-log-week';
import type {
  ProjectsActorContext,
  TimesheetView,
} from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import {
  PROJECT_NOTIFICATION_EVENT,
  ProjectNotificationService,
  type ProjectNotificationEvent,
} from './project-notification.service';
import { ProjectTimePolicyService } from './project-time-policy.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectTimesheetQueryService } from './project-timesheet-query.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class ProjectTimesheetCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ProjectCommandReceiptService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly query: ProjectTimesheetQueryService,
    private readonly notifications: ProjectNotificationService,
    private readonly timePolicy: ProjectTimePolicyService,
  ) {}

  async create(
    dto: CreateTimesheetDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const employeeId = this.query.requireActorEmployee(actor);
    const employee = await this.requireActiveEmployee(employeeId);
    await this.gate.assertEnabledForContext(employee.companyId);

    const { periodStart, periodEnd } =
      await this.timePolicy.resolveTimesheetPeriod({
        companyId: employee.companyId,
        branchId: employee.branchId,
        requestedPeriodStart: dto.periodStart,
      });

    return this.receipts.claimOrReplay({
      companyId: employee.companyId,
      commandType: 'TIMESHEET_CREATE',
      operationId: dto.operationId,
      requestPayload: { ...dto, employeeId },
      execute: async (tx) => {
        const existing = await tx.workLogHeader.findFirst({
          where: {
            companyId: employee.companyId,
            employeeId,
            periodStart,
          },
        });
        if (existing) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
            'A timesheet already exists for this period.',
          );
        }

        const created = await tx.workLogHeader.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId,
            startDate: periodStart,
            endDate: periodEnd,
            periodStart,
            periodEnd,
            totalHours: new Prisma.Decimal(0),
            status: 'DRAFT',
            statusV2: WorkLogStatus.DRAFT,
            remarks: dto.remarks?.trim(),
          },
          include: ProjectTimesheetQueryService.headerInclude,
        });

        await this.writeActionEvent(tx, {
          companyId: employee.companyId,
          entityId: created.id,
          projectId: null,
          fromState: null,
          toState: WorkLogStatus.DRAFT,
          actorUserId: actor.userId,
          versionBefore: null,
          versionAfter: created.version,
          operationId: dto.operationId,
        });

        const view = this.query.toView(created, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async update(
    id: string,
    dto: UpdateTimesheetDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedEditable(id, actor);

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: 'TIMESHEET_UPDATE',
      operationId: dto.operationId,
      requestPayload: { id, ...dto },
      execute: async (tx) => {
        const updated = await this.casUpdateHeader(
          tx,
          id,
          dto.expectedVersion,
          {
            remarks: dto.remarks === undefined ? undefined : dto.remarks,
          },
        );
        const full = await this.loadHeader(tx, updated.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async addLine(
    id: string,
    dto: AddTimesheetLineDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedEditable(id, actor);
    this.assertXorTarget(dto.taskId, dto.workCategoryId);

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: 'TIMESHEET_LINE_ADD',
      operationId: dto.operationId,
      requestPayload: { id, ...dto },
      execute: async (tx) => {
        const locked = await this.requireHeaderInTx(
          tx,
          header.id,
          header.companyId,
        );
        this.assertEditable(locked.statusV2 ?? 'DRAFT');
        this.assertHeaderVersion(locked.version, dto.expectedVersion);

        const workDate = toUtcDateOnly(parseDateOnly(dto.workDate));
        if (
          !isDateWithinInclusive(
            workDate,
            locked.periodStart ?? locked.startDate,
            locked.periodEnd ?? locked.endDate,
          )
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_LINE_OUTSIDE_PERIOD,
            'Work date must fall within the timesheet period.',
          );
        }

        const hours = new Prisma.Decimal(dto.hours);
        this.assertHoursRange(hours);
        await this.assertDailyCap(tx, locked.employeeId, workDate, hours, null);

        if (dto.taskId) {
          await this.assertActiveTaskAssignment(
            tx,
            locked.companyId,
            locked.branchId,
            locked.employeeId,
            dto.taskId,
            workDate,
          );
        } else if (dto.workCategoryId) {
          await this.assertActiveCategory(
            tx,
            locked.companyId,
            dto.workCategoryId,
          );
        }

        await tx.workLogLine.create({
          data: {
            companyId: locked.companyId,
            branchId: locked.branchId,
            employeeId: locked.employeeId,
            workLogHeaderId: locked.id,
            workDate,
            taskId: dto.taskId ?? null,
            workCategoryId: dto.workCategoryId ?? null,
            hours,
            sourceType: 'MANUAL_ENTRY',
            remarks: dto.remarks?.trim(),
          },
        });

        await this.recalculateTotal(tx, locked.id);
        const bumped = await this.casUpdateHeader(
          tx,
          locked.id,
          dto.expectedVersion,
          {},
        );
        const full = await this.loadHeader(tx, bumped.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: bumped.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async updateLine(
    id: string,
    lineId: string,
    dto: UpdateTimesheetLineDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedEditable(id, actor);

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: 'TIMESHEET_LINE_UPDATE',
      operationId: dto.operationId,
      requestPayload: { id, lineId, ...dto },
      execute: async (tx) => {
        const locked = await this.requireHeaderInTx(
          tx,
          header.id,
          header.companyId,
        );
        this.assertEditable(locked.statusV2 ?? 'DRAFT');
        this.assertHeaderVersion(locked.version, dto.expectedVersion);

        const line = await tx.workLogLine.findFirst({
          where: { id: lineId, workLogHeaderId: locked.id },
        });
        if (!line || line.version !== dto.lineExpectedVersion) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
            'Timesheet line version changed. Reload and retry.',
          );
        }

        const nextTaskId = dto.taskId === undefined ? line.taskId : dto.taskId;
        const nextCategoryId =
          dto.workCategoryId === undefined
            ? line.workCategoryId
            : dto.workCategoryId;
        this.assertXorTarget(nextTaskId, nextCategoryId);

        const workDate = dto.workDate
          ? toUtcDateOnly(parseDateOnly(dto.workDate))
          : toUtcDateOnly(line.workDate);
        if (
          !isDateWithinInclusive(
            workDate,
            locked.periodStart ?? locked.startDate,
            locked.periodEnd ?? locked.endDate,
          )
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_LINE_OUTSIDE_PERIOD,
            'Work date must fall within the timesheet period.',
          );
        }

        const hours = dto.hours ? new Prisma.Decimal(dto.hours) : line.hours;
        this.assertHoursRange(hours);
        await this.assertDailyCap(
          tx,
          locked.employeeId,
          workDate,
          hours,
          line.id,
        );

        if (nextTaskId) {
          await this.assertActiveTaskAssignment(
            tx,
            locked.companyId,
            locked.branchId,
            locked.employeeId,
            nextTaskId,
            workDate,
          );
        } else if (nextCategoryId) {
          await this.assertActiveCategory(tx, locked.companyId, nextCategoryId);
        }

        await tx.workLogLine.update({
          where: { id: lineId },
          data: {
            workDate,
            hours,
            taskId: nextTaskId,
            workCategoryId: nextCategoryId,
            remarks: dto.remarks === undefined ? undefined : dto.remarks,
            version: { increment: 1 },
          },
        });

        await this.recalculateTotal(tx, locked.id);
        const bumped = await this.casUpdateHeader(
          tx,
          locked.id,
          dto.expectedVersion,
          {},
        );
        const full = await this.loadHeader(tx, bumped.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: bumped.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async removeLine(
    id: string,
    lineId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedEditable(id, actor);

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: 'TIMESHEET_LINE_REMOVE',
      operationId: dto.operationId,
      requestPayload: { id, lineId, ...dto },
      execute: async (tx) => {
        const locked = await this.requireHeaderInTx(
          tx,
          header.id,
          header.companyId,
        );
        this.assertEditable(locked.statusV2 ?? 'DRAFT');
        this.assertHeaderVersion(locked.version, dto.expectedVersion);

        const line = await tx.workLogLine.findFirst({
          where: { id: lineId, workLogHeaderId: locked.id },
        });
        if (!line) {
          throw new DomainNotFoundException(
            PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
            'Timesheet line not found',
          );
        }

        await tx.workLogLine.delete({ where: { id: lineId } });
        await this.recalculateTotal(tx, locked.id);
        const bumped = await this.casUpdateHeader(
          tx,
          locked.id,
          dto.expectedVersion,
          {},
        );
        const full = await this.loadHeader(tx, bumped.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: bumped.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async submit(
    id: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedHeader(id, actor);
    const from = header.statusV2 ?? 'DRAFT';
    if (!canTransitionWorkLog(from, WorkLogStatus.SUBMITTED)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        `Cannot submit timesheet from ${from}.`,
      );
    }

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: 'TIMESHEET_SUBMIT',
      operationId: dto.operationId,
      requestPayload: { id, ...dto },
      execute: async (tx) => {
        const locked = await this.requireHeaderInTx(
          tx,
          header.id,
          header.companyId,
        );
        this.assertHeaderVersion(locked.version, dto.expectedVersion);

        const lines = await tx.workLogLine.findMany({
          where: { workLogHeaderId: locked.id },
        });
        if (lines.length === 0) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
            'Timesheet contains no lines.',
          );
        }

        let total = new Prisma.Decimal(0);
        for (const line of lines) {
          if (
            !isDateWithinInclusive(
              line.workDate,
              locked.periodStart ?? locked.startDate,
              locked.periodEnd ?? locked.endDate,
            )
          ) {
            throw new DomainConflictException(
              PROJECTS_ERROR_CODES.TIMESHEET_LINE_OUTSIDE_PERIOD,
              'A line falls outside the timesheet period.',
            );
          }
          this.assertHoursRange(line.hours);
          total = total.add(line.hours);
          if (line.taskId) {
            await this.assertActiveTaskAssignment(
              tx,
              locked.companyId,
              locked.branchId,
              locked.employeeId,
              line.taskId,
              line.workDate,
            );
          }
        }
        if (total.lte(0)) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
            'Timesheet total hours must be greater than zero.',
          );
        }

        const manager = await this.resolveReportingManager(
          tx,
          locked.employeeId,
        );

        const now = new Date();
        const updated = await this.casUpdateHeader(
          tx,
          locked.id,
          dto.expectedVersion,
          {
            status: 'SUBMITTED',
            statusV2: WorkLogStatus.SUBMITTED,
            submittedAt: now,
            submittedByUserId: actor.userId,
            reportingManagerEmployeeId: manager.employeeId,
            reportingManagerUserId: manager.userId,
            totalHours: total,
            returnedAt: null,
            returnedByUserId: null,
            returnReason: null,
          },
        );

        await this.writeActionEvent(tx, {
          companyId: locked.companyId,
          entityId: locked.id,
          projectId: null,
          fromState: locked.statusV2,
          toState: WorkLogStatus.SUBMITTED,
          actorUserId: actor.userId,
          versionBefore: locked.version,
          versionAfter: updated.version,
          operationId: dto.operationId,
        });

        await this.notifications.enqueue(tx, {
          eventType: PROJECT_NOTIFICATION_EVENT.TIMESHEET_SUBMITTED,
          aggregateType: 'WORK_LOG_HEADER',
          aggregateId: locked.id,
          companyId: locked.companyId,
          branchId: locked.branchId,
          employeeId: locked.employeeId,
          status: WorkLogStatus.SUBMITTED,
          version: updated.version,
          recipientUserIds: [manager.userId],
          dedupeKey: `projects.timesheet.submitted:${locked.id}:${updated.version}`,
        });

        const full = await this.loadHeader(tx, updated.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async cancel(
    id: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const header = await this.requireOwnedHeader(id, actor);
    const from = header.statusV2 ?? 'DRAFT';
    if (!canTransitionWorkLog(from, WorkLogStatus.CANCELLED)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        `Cannot cancel timesheet from ${from}.`,
      );
    }

    return this.lifecycle(id, dto, actor, {
      commandType: 'TIMESHEET_CANCEL',
      toStatus: WorkLogStatus.CANCELLED,
      requireOwner: true,
      patch: (now, userId, reason) => ({
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledByUserId: userId,
        cancellationReason: reason ?? null,
      }),
      eventType: PROJECT_NOTIFICATION_EVENT.TIMESHEET_CANCELLED,
    });
  }

  async approve(
    id: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    return this.lifecycle(id, dto, actor, {
      commandType: 'TIMESHEET_APPROVE',
      toStatus: WorkLogStatus.APPROVED,
      requireManager: true,
      patch: (now, userId) => ({
        status: 'APPROVED',
        approvedAt: now,
        approvedByUserId: userId,
      }),
      eventType: PROJECT_NOTIFICATION_EVENT.TIMESHEET_APPROVED,
    });
  }

  async returnTimesheet(
    id: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    return this.lifecycle(id, dto, actor, {
      commandType: 'TIMESHEET_RETURN',
      toStatus: WorkLogStatus.RETURNED,
      requireManager: true,
      patch: (now, userId, reason) => ({
        status: 'RETURNED',
        returnedAt: now,
        returnedByUserId: userId,
        returnReason: reason ?? null,
      }),
      eventType: PROJECT_NOTIFICATION_EVENT.TIMESHEET_RETURNED,
    });
  }

  private async lifecycle(
    id: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
    options: {
      commandType: string;
      toStatus: WorkLogStatus;
      requireOwner?: boolean;
      requireManager?: boolean;
      patch: (
        now: Date,
        userId: string,
        reason?: string,
      ) => Prisma.WorkLogHeaderUncheckedUpdateManyInput;
      eventType: ProjectNotificationEvent;
    },
  ): Promise<TimesheetView> {
    const header = options.requireOwner
      ? await this.requireOwnedHeader(id, actor)
      : await this.requireManagedHeader(id, actor);

    await this.gate.assertEnabledForContext(header.companyId ?? undefined);
    const from = header.statusV2 ?? 'DRAFT';
    if (!canTransitionWorkLog(from, options.toStatus)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        `Cannot transition timesheet from ${from} to ${options.toStatus}.`,
      );
    }

    if (options.requireManager) {
      this.assertManagerActor(header, actor);
    }

    return this.receipts.claimOrReplay({
      companyId: header.companyId,
      commandType: options.commandType,
      operationId: dto.operationId,
      requestPayload: { id, ...dto },
      execute: async (tx) => {
        const locked = await this.requireHeaderInTx(
          tx,
          header.id,
          header.companyId,
        );
        this.assertHeaderVersion(locked.version, dto.expectedVersion);
        if (
          !canTransitionWorkLog(locked.statusV2 ?? 'DRAFT', options.toStatus)
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
            `Cannot transition timesheet from ${locked.statusV2} to ${options.toStatus}.`,
          );
        }
        if (options.requireManager) {
          this.assertManagerActor(locked, actor);
        }

        const now = new Date();
        const updated = await this.casUpdateHeader(
          tx,
          locked.id,
          dto.expectedVersion,
          {
            ...options.patch(now, actor.userId, dto.reason),
            statusV2: options.toStatus,
          },
        );

        await this.writeActionEvent(tx, {
          companyId: locked.companyId,
          entityId: locked.id,
          projectId: null,
          fromState: locked.statusV2,
          toState: options.toStatus,
          actorUserId: actor.userId,
          versionBefore: locked.version,
          versionAfter: updated.version,
          operationId: dto.operationId,
          protectedReason: dto.reason,
        });

        const submitterUserId = locked.submittedByUserId;
        const employeeUserId = await this.notifications.resolveEmployeeUserId(
          tx,
          locked.employeeId,
        );
        await this.notifications.enqueue(tx, {
          eventType: options.eventType,
          aggregateType: 'WORK_LOG_HEADER',
          aggregateId: locked.id,
          companyId: locked.companyId,
          branchId: locked.branchId,
          employeeId: locked.employeeId,
          status: options.toStatus,
          version: updated.version,
          recipientUserIds: [
            submitterUserId,
            employeeUserId,
            options.requireManager ? null : actor.userId,
          ].filter((id): id is string => Boolean(id)),
          dedupeKey: `${options.eventType}:${locked.id}:${updated.version}`,
        });

        const full = await this.loadHeader(tx, updated.id);
        const view = this.query.toView(full, actor);
        return {
          entityType: 'WORK_LOG',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private assertManagerActor(
    header: {
      reportingManagerUserId: string | null;
      submittedByUserId: string | null;
    },
    actor: ProjectsActorContext,
  ) {
    if (!header.reportingManagerUserId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_APPROVER_NOT_CONFIGURED,
        'Timesheet has no snapshotted reporting manager.',
      );
    }
    if (header.reportingManagerUserId !== actor.userId) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    if (header.submittedByUserId && header.submittedByUserId === actor.userId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        'Submitter cannot approve or return their own timesheet.',
      );
    }
  }

  private async requireOwnedEditable(id: string, actor: ProjectsActorContext) {
    const header = await this.requireOwnedHeader(id, actor);
    this.assertEditable(header.statusV2 ?? 'DRAFT');
    return header;
  }

  private async requireOwnedHeader(id: string, actor: ProjectsActorContext) {
    const employeeId = this.query.requireActorEmployee(actor);
    await this.gate.assertEnabledForContext(actor.companyId);
    const header = await this.prisma.workLogHeader.findFirst({
      where: {
        id,
        employeeId,
        ...(actor.companyId ? { companyId: actor.companyId } : {}),
      },
      include: ProjectTimesheetQueryService.headerInclude,
    });
    if (!header) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    return header;
  }

  private async requireManagedHeader(id: string, actor: ProjectsActorContext) {
    await this.gate.assertEnabledForContext(actor.companyId);
    const header = await this.prisma.workLogHeader.findFirst({
      where: {
        id,
        reportingManagerUserId: actor.userId,
        ...(actor.companyId ? { companyId: actor.companyId } : {}),
      },
      include: ProjectTimesheetQueryService.headerInclude,
    });
    if (!header) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    return header;
  }

  private async requireHeaderInTx(tx: DbClient, id: string, companyId: string) {
    await tx.$executeRaw`
      SELECT id FROM work_log_headers
      WHERE id = ${id} AND "companyId" = ${companyId}
      FOR UPDATE
    `;
    const header = await tx.workLogHeader.findFirst({
      where: { id, companyId },
    });
    if (!header) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    return header;
  }

  private async loadHeader(tx: DbClient, id: string) {
    return tx.workLogHeader.findUniqueOrThrow({
      where: { id },
      include: ProjectTimesheetQueryService.headerInclude,
    });
  }

  private assertEditable(status: WorkLogStatus) {
    if (!isEditableWorkLogStatus(status)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        'Timesheet is not editable in the current state.',
      );
    }
  }

  private assertHeaderVersion(actual: number, expected: number) {
    if (actual !== expected) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        'Timesheet version changed. Reload and retry.',
      );
    }
  }

  private assertXorTarget(
    taskId?: string | null,
    workCategoryId?: string | null,
  ) {
    if (!isXorTaskOrCategory(taskId, workCategoryId)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        'Exactly one of taskId or workCategoryId is required.',
      );
    }
  }

  private assertHoursRange(hours: Prisma.Decimal) {
    if (!isValidLineHours(hours)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_DAILY_HOURS_EXCEEDED,
        'Hours must be greater than 0 and at most 24.',
      );
    }
  }

  private async assertDailyCap(
    tx: DbClient,
    employeeId: string,
    workDate: Date,
    hours: Prisma.Decimal,
    excludeLineId: string | null,
  ) {
    const day = toUtcDateOnly(workDate);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const lines = await tx.workLogLine.findMany({
      where: {
        employeeId,
        workDate: { gte: day, lt: nextDay },
        ...(excludeLineId ? { id: { not: excludeLineId } } : {}),
      },
      select: { hours: true },
    });
    const sum = lines.reduce(
      (acc, row) => acc.add(row.hours),
      new Prisma.Decimal(0),
    );
    if (exceedsDailyHoursCap(sum, hours)) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_DAILY_HOURS_EXCEEDED,
        'Daily hours across timesheets cannot exceed 24.',
      );
    }
  }

  private async assertActiveTaskAssignment(
    tx: DbClient,
    companyId: string,
    branchId: string,
    employeeId: string,
    taskId: string,
    workDate: Date,
  ) {
    const { start, endExclusive } = await this.timePolicy.businessDayWindow({
      companyId,
      branchId,
      workDate,
    });
    const participant = await tx.taskParticipant.findFirst({
      where: {
        companyId,
        employeeId,
        taskId,
        AND: [
          {
            OR: [
              { assignedAt: { lt: endExclusive } },
              { assignedAt: null, createdAt: { lt: endExclusive } },
            ],
          },
          {
            OR: [
              { endedAt: null, statusV2: 'ACTIVE' },
              { endedAt: { gte: start } },
            ],
          },
        ],
        task: {
          statusV2: { notIn: ['CANCELLED'] },
          project: { statusV2: { notIn: ['CANCELLED'] } },
        },
      },
      select: { projectId: true },
    });
    if (participant) {
      const teamMember = await tx.projectTeamMember.findFirst({
        where: {
          companyId,
          projectId: participant.projectId,
          employeeId,
          AND: [
            {
              OR: [{ startDate: null }, { startDate: { lt: endExclusive } }],
            },
            {
              OR: [
                { endDate: null, statusV2: 'ACTIVE', isActive: true },
                { endDate: { gte: start } },
              ],
            },
          ],
        },
        select: { id: true },
      });
      if (teamMember) {
        return;
      }
    }

    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.TASK_NOT_ASSIGNED_TO_ACTOR,
      'Employee is not an effective task participant on the work date.',
    );
  }

  private async assertActiveCategory(
    tx: DbClient,
    companyId: string,
    workCategoryId: string,
  ) {
    const category = await tx.workCategory.findFirst({
      where: {
        id: workCategoryId,
        isActive: true,
        OR: [{ companyId }, { companyId: null }],
      },
      select: { id: true },
    });
    if (!category) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Work category not found',
      );
    }
  }

  private async resolveReportingManager(tx: DbClient, employeeId: string) {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    });
    if (!employee?.managerId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_APPROVER_NOT_CONFIGURED,
        'Reporting manager is not configured for this employee.',
      );
    }

    const managerUser = await tx.user.findFirst({
      where: {
        employeeId: employee.managerId,
        status: 'ACTIVE',
      },
      select: { id: true, employeeId: true },
    });
    if (!managerUser?.employeeId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_APPROVER_NOT_CONFIGURED,
        'Reporting manager has no active user account.',
      );
    }

    return {
      employeeId: managerUser.employeeId,
      userId: managerUser.id,
    };
  }

  private async requireActiveEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, isActive: true },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!employee) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_ASSIGNED_TO_ACTOR,
        'Active employee context is required for timesheets.',
      );
    }
    return employee;
  }

  private async recalculateTotal(tx: DbClient, headerId: string) {
    const lines = await tx.workLogLine.findMany({
      where: { workLogHeaderId: headerId },
      select: { hours: true },
    });
    const total = lines.reduce(
      (acc, row) => acc.add(row.hours),
      new Prisma.Decimal(0),
    );
    await tx.workLogHeader.update({
      where: { id: headerId },
      data: { totalHours: total },
    });
  }

  private async casUpdateHeader(
    tx: DbClient,
    id: string,
    expectedVersion: number,
    data: Prisma.WorkLogHeaderUncheckedUpdateManyInput,
  ) {
    const result = await tx.workLogHeader.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
        'Timesheet version changed. Reload and retry.',
      );
    }
    return tx.workLogHeader.findUniqueOrThrow({ where: { id } });
  }

  private async writeActionEvent(
    tx: DbClient,
    input: {
      companyId: string;
      entityId: string;
      projectId: string | null;
      fromState: string | null;
      toState: string;
      actorUserId: string;
      versionBefore: number | null;
      versionAfter: number;
      operationId: string;
      protectedReason?: string;
    },
  ) {
    await tx.projectActionEvent.create({
      data: {
        companyId: input.companyId,
        entityType: ProjectActionEntityType.WORK_LOG,
        entityId: input.entityId,
        projectId: input.projectId,
        fromState: input.fromState,
        toState: input.toState,
        actorUserId: input.actorUserId,
        versionBefore: input.versionBefore,
        versionAfter: input.versionAfter,
        operationId: input.operationId,
        protectedReason: input.protectedReason,
      },
    });
  }
}
