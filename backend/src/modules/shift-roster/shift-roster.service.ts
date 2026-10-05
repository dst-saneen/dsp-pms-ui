import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DayPortion,
  Prisma,
  ShiftRosterDayType,
  ShiftRosterEntrySource,
  ShiftRosterStatus,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarConsumerService } from '../business-calendar/business-calendar-consumer.service';
import type { PrismaTx } from '../workforce-approval/workforce-approval-resolver.service';

import {
  CreateShiftRosterDto,
  CreateShiftRosterOverrideDto,
  GenerateShiftRosterDto,
  ShiftRosterFilterDto,
  ShiftRosterTransitionDto,
  UpdateShiftRosterDto,
} from './dto';
import { ShiftRosterGenerationService } from './shift-roster-generation.service';
import { acquireBranchRosterAdvisoryLock } from './shift-roster-lock.util';
import { ShiftRosterOutboxService } from './shift-roster-outbox.service';
import {
  assertRosterPeriodRange,
  calendarDateToDbDate,
  calendarRangesOverlap,
  parseCalendarDateInput,
} from './shift-roster-period.util';
import { ShiftRosterGenerationEntry } from './shift-roster.types';

@Injectable()
export class ShiftRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly generationService: ShiftRosterGenerationService,
    private readonly outboxService: ShiftRosterOutboxService,
    private readonly auditService: AuditService,
    private readonly calendarConsumer: BusinessCalendarConsumerService,
  ) {}

  async create(dto: CreateShiftRosterDto, actor: AuthenticatedUser) {
    const branch = await this.loadBranch(dto.branchId);
    const periodStart = parseCalendarDateInput(dto.periodStart);
    const periodEnd = parseCalendarDateInput(dto.periodEnd);
    assertRosterPeriodRange(periodStart, periodEnd);

    return this.prisma.$transaction(async (tx) => {
      const roster = await tx.shiftRoster.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          periodStart: calendarDateToDbDate(periodStart),
          periodEnd: calendarDateToDbDate(periodEnd),
          status: ShiftRosterStatus.DRAFT,
          createdByUserId: actor.id,
        },
        include: this.rosterInclude(),
      });

      await this.auditService.log(
        'ShiftRoster',
        roster.id,
        'CREATE',
        null,
        { status: roster.status, periodStart, periodEnd },
        { tx },
      );

      return roster;
    });
  }

  async findAll(filters: ShiftRosterFilterDto) {
    const where: Prisma.ShiftRosterWhereInput = {
      ...this.employeeDomainScope.shiftRosterWhere(),
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }
    if (filters.companyId) {
      where.companyId = filters.companyId;
    }
    if (filters.status) {
      where.status = filters.status as ShiftRosterStatus;
    }

    return this.prisma.shiftRoster.findMany({
      where,
      include: this.rosterInclude(),
      orderBy: [{ periodStart: 'desc' }, { version: 'desc' }],
    });
  }

  async findOne(id: string) {
    const roster = await this.prisma.shiftRoster.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.shiftRosterWhere(),
      },
      include: {
        ...this.rosterInclude(),
        entries: {
          orderBy: [{ workDate: 'asc' }, { employeeId: 'asc' }],
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
            shift: true,
            overrides: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!roster) {
      throw new NotFoundException('Shift roster not found');
    }

    return roster;
  }

  async update(
    id: string,
    dto: UpdateShiftRosterDto,
    actor: AuthenticatedUser,
  ) {
    const roster = await this.findDraftRoster(id);
    const periodStart = parseCalendarDateInput(
      dto.periodStart ?? roster.periodStart,
    );
    const periodEnd = parseCalendarDateInput(dto.periodEnd ?? roster.periodEnd);
    assertRosterPeriodRange(periodStart, periodEnd);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shiftRoster.update({
        where: { id },
        data: {
          periodStart: calendarDateToDbDate(periodStart),
          periodEnd: calendarDateToDbDate(periodEnd),
        },
        include: this.rosterInclude(),
      });

      await this.auditService.log(
        'ShiftRoster',
        id,
        'UPDATE',
        {
          periodStart: parseCalendarDateInput(roster.periodStart),
          periodEnd: parseCalendarDateInput(roster.periodEnd),
        },
        { periodStart, periodEnd, actorUserId: actor.id },
        { tx },
      );

      return updated;
    });
  }

  async generate(dto: GenerateShiftRosterDto, actor: AuthenticatedUser) {
    const dryRun = dto.dryRun !== false;
    const branch = await this.loadBranch(dto.branchId);
    const periodStart = parseCalendarDateInput(dto.periodStart);
    const periodEnd = parseCalendarDateInput(dto.periodEnd);
    assertRosterPeriodRange(periodStart, periodEnd);

    let rosterId = dto.shiftRosterId;
    let existingEntries: Awaited<
      ReturnType<typeof this.loadGenerationContext>
    >['existingEntries'] = [];

    if (rosterId) {
      const roster = await this.findDraftRoster(rosterId);
      if (roster.branchId !== branch.id) {
        throw new BadRequestException('Roster branch mismatch');
      }
      existingEntries = roster.entries;
    } else if (!dryRun) {
      const created = await this.create(
        {
          branchId: branch.id,
          periodStart,
          periodEnd,
        },
        actor,
      );
      rosterId = created.id;
    } else {
      rosterId = `dry-run:${branch.id}`;
    }

    const context = await this.loadGenerationContext(
      branch.id,
      periodStart,
      periodEnd,
      rosterId,
      existingEntries,
    );
    const result = this.generationService.generate({
      ...context,
      existingEntries: existingEntries as never,
    });

    if (dryRun) {
      return { dryRun: true, ...result };
    }

    return this.prisma.$transaction(async (tx) => {
      await acquireBranchRosterAdvisoryLock(tx, branch.id);
      const roster = await this.findDraftRoster(rosterId, tx);

      await this.applyGenerationEntries(
        tx,
        roster.id,
        branch.companyId,
        branch.id,
        result.entries,
      );

      await this.auditService.log(
        'ShiftRoster',
        roster.id,
        'GENERATE',
        null,
        result.summary,
        { tx },
      );

      await this.outboxService.write(tx, {
        aggregateType: 'ShiftRoster',
        aggregateId: roster.id,
        eventType: 'SHIFT_ROSTER_GENERATED',
        payload: {
          rosterId: roster.id,
          branchId: branch.id,
          periodStart,
          periodEnd,
          summary: result.summary,
        },
        dedupeKey: `shift-roster:${roster.id}:generated:v${roster.version}:${Date.now()}`,
        companyId: branch.companyId,
        branchId: branch.id,
      });

      return {
        dryRun: false,
        roster: await tx.shiftRoster.findUniqueOrThrow({
          where: { id: roster.id },
          include: this.rosterInclude(),
        }),
        ...result,
      };
    });
  }

  async publish(
    id: string,
    dto: ShiftRosterTransitionDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const roster = await this.findDraftRoster(id, tx);
      await acquireBranchRosterAdvisoryLock(tx, roster.branchId);
      await this.assertNoPublishedOverlap(tx, roster);

      const missingShiftCount = roster.entries.filter(
        (entry) =>
          entry.dayType === ShiftRosterDayType.WORKING && !entry.shiftId,
      ).length;
      if (missingShiftCount > 0) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.SHIFT_ASSIGNMENT_REQUIRED,
          message: `Cannot publish: ${missingShiftCount} working day(s) have no shift assigned. Assign shifts or regenerate the roster first.`,
          missingShiftCount,
        });
      }

      const transition = await tx.shiftRoster.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: ShiftRosterStatus.DRAFT,
        },
        data: {
          status: ShiftRosterStatus.PUBLISHED,
          version: { increment: 1 },
          publishedByUserId: actor.id,
          publishedAt: new Date(),
        },
      });

      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Roster version changed or status is no longer draft',
        });
      }

      const updated = await tx.shiftRoster.findUniqueOrThrow({
        where: { id },
        include: this.rosterInclude(),
      });

      await this.auditService.log(
        'ShiftRoster',
        id,
        'PUBLISH',
        { status: ShiftRosterStatus.DRAFT, version: dto.expectedVersion },
        { status: updated.status, version: updated.version },
        { tx },
      );

      await this.outboxService.write(tx, {
        aggregateType: 'ShiftRoster',
        aggregateId: id,
        eventType: 'SHIFT_ROSTER_PUBLISHED',
        payload: {
          rosterId: id,
          branchId: updated.branchId,
          periodStart: parseCalendarDateInput(updated.periodStart),
          periodEnd: parseCalendarDateInput(updated.periodEnd),
          version: updated.version,
        },
        dedupeKey: `shift-roster:${id}:published:v${updated.version}`,
        companyId: updated.companyId,
        branchId: updated.branchId,
      });

      return updated;
    });
  }

  async lock(
    id: string,
    dto: ShiftRosterTransitionDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branchId = (
        await tx.shiftRoster.findFirstOrThrow({
          where: { id },
          select: { branchId: true },
        })
      ).branchId;
      await acquireBranchRosterAdvisoryLock(tx, branchId);

      const transition = await tx.shiftRoster.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: ShiftRosterStatus.PUBLISHED,
        },
        data: {
          status: ShiftRosterStatus.LOCKED,
          version: { increment: 1 },
          lockedByUserId: actor.id,
          lockedAt: new Date(),
        },
      });

      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Roster cannot transition from PUBLISHED',
        });
      }

      const updated = await tx.shiftRoster.findUniqueOrThrow({
        where: { id },
        include: this.rosterInclude(),
      });

      await this.auditService.log(
        'ShiftRoster',
        id,
        'LOCK',
        { status: ShiftRosterStatus.PUBLISHED, version: dto.expectedVersion },
        { status: ShiftRosterStatus.LOCKED, version: updated.version },
        { tx },
      );

      await this.outboxService.write(tx, {
        aggregateType: 'ShiftRoster',
        aggregateId: id,
        eventType: 'SHIFT_ROSTER_LOCKED',
        payload: {
          rosterId: id,
          status: ShiftRosterStatus.LOCKED,
          version: updated.version,
        },
        dedupeKey: `shift-roster:${id}:shift_roster_locked:v${updated.version}`,
        companyId: updated.companyId,
        branchId: updated.branchId,
      });

      return updated;
    });
  }

  async archive(
    id: string,
    dto: ShiftRosterTransitionDto,
    actor: AuthenticatedUser,
  ) {
    const roster = await this.prisma.shiftRoster.findFirst({
      where: { id, ...this.employeeDomainScope.shiftRosterWhere() },
    });
    if (!roster) {
      throw new NotFoundException('Shift roster not found');
    }

    const fromStatus =
      roster.status === ShiftRosterStatus.LOCKED
        ? ShiftRosterStatus.LOCKED
        : roster.status === ShiftRosterStatus.PUBLISHED
          ? ShiftRosterStatus.PUBLISHED
          : null;

    if (!fromStatus) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Only published or locked rosters can be archived',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await acquireBranchRosterAdvisoryLock(tx, roster.branchId);

      const transition = await tx.shiftRoster.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: fromStatus,
        },
        data: {
          status: ShiftRosterStatus.ARCHIVED,
          version: { increment: 1 },
          archivedByUserId: actor.id,
          archivedAt: new Date(),
        },
      });

      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: `Roster cannot transition from ${fromStatus}`,
        });
      }

      const updated = await tx.shiftRoster.findUniqueOrThrow({
        where: { id },
        include: this.rosterInclude(),
      });

      await this.auditService.log(
        'ShiftRoster',
        id,
        'ARCHIVE',
        { status: fromStatus, version: dto.expectedVersion },
        { status: ShiftRosterStatus.ARCHIVED, version: updated.version },
        { tx },
      );

      await this.outboxService.write(tx, {
        aggregateType: 'ShiftRoster',
        aggregateId: id,
        eventType: 'SHIFT_ROSTER_ARCHIVED',
        payload: {
          rosterId: id,
          status: ShiftRosterStatus.ARCHIVED,
          version: updated.version,
        },
        dedupeKey: `shift-roster:${id}:shift_roster_archived:v${updated.version}`,
        companyId: updated.companyId,
        branchId: updated.branchId,
      });

      return updated;
    });
  }

  async override(
    id: string,
    dto: CreateShiftRosterOverrideDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const roster = await tx.shiftRoster.findFirst({
        where: {
          id,
          status: ShiftRosterStatus.PUBLISHED,
          ...this.employeeDomainScope.shiftRosterWhere(),
        },
      });

      if (!roster) {
        throw new NotFoundException('Published shift roster not found');
      }

      if (roster.version !== dto.expectedVersion) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Roster version changed',
        });
      }

      const entry = await tx.shiftRosterEntry.findFirst({
        where: {
          id: dto.shiftRosterEntryId,
          shiftRosterId: id,
          ...this.employeeDomainScope.shiftRosterEntryWhere(),
        },
      });

      if (!entry) {
        throw new NotFoundException('Shift roster entry not found');
      }

      const previousSnapshot = this.entrySnapshot(entry);
      const newSnapshot = {
        ...previousSnapshot,
        ...dto.newSnapshot,
      };

      if (!dto.reason?.trim()) {
        throw new BadRequestException('Override reason is required');
      }

      await tx.shiftRosterOverride.create({
        data: {
          shiftRosterEntryId: entry.id,
          companyId: entry.companyId,
          branchId: entry.branchId,
          employeeId: entry.employeeId,
          previousSnapshot,
          newSnapshot,
          reason: dto.reason.trim(),
          changedByUserId: actor.id,
        },
      });

      const updatedEntry = await tx.shiftRosterEntry.update({
        where: { id: entry.id },
        data: {
          shiftId: newSnapshot.shiftId ?? null,
          scheduledStartAt: newSnapshot.scheduledStartAt
            ? new Date(newSnapshot.scheduledStartAt)
            : null,
          scheduledEndAt: newSnapshot.scheduledEndAt
            ? new Date(newSnapshot.scheduledEndAt)
            : null,
          breakMinutes: newSnapshot.breakMinutes ?? entry.breakMinutes,
          scheduledNetMinutes:
            newSnapshot.scheduledNetMinutes ?? entry.scheduledNetMinutes,
          dayType:
            (newSnapshot.dayType as typeof entry.dayType) ?? entry.dayType,
          dayPortion:
            (newSnapshot.dayPortion as typeof entry.dayPortion) ??
            entry.dayPortion,
          source: ShiftRosterEntrySource.MANUAL_OVERRIDE,
        },
      });

      await tx.shiftRoster.update({
        where: { id },
        data: { version: { increment: 1 } },
      });

      await this.auditService.log(
        'ShiftRosterEntry',
        entry.id,
        'OVERRIDE',
        previousSnapshot,
        newSnapshot,
        { tx },
      );

      await this.outboxService.write(tx, {
        aggregateType: 'ShiftRoster',
        aggregateId: id,
        eventType: 'SHIFT_ROSTER_ENTRY_OVERRIDDEN',
        payload: {
          rosterId: id,
          entryId: entry.id,
          employeeId: entry.employeeId,
          workDate: parseCalendarDateInput(entry.workDate),
        },
        dedupeKey: `shift-roster:${id}:override:${entry.id}:${Date.now()}`,
        companyId: entry.companyId,
        branchId: entry.branchId,
      });

      return updatedEntry;
    });
  }

  private async applyGenerationEntries(
    tx: PrismaTx,
    rosterId: string,
    companyId: string,
    branchId: string,
    entries: ShiftRosterGenerationEntry[],
  ) {
    for (const entry of entries) {
      if (entry.action === 'retain' || entry.action === 'skip') {
        continue;
      }

      if (entry.action === 'delete' && entry.existingEntryId) {
        await tx.shiftRosterEntry.delete({
          where: { id: entry.existingEntryId },
        });
        continue;
      }

      const data = {
        companyId,
        branchId,
        employeeId: entry.employeeId,
        workDate: calendarDateToDbDate(entry.workDate),
        shiftId: entry.shiftId,
        scheduledStartAt: entry.scheduledStartAt,
        scheduledEndAt: entry.scheduledEndAt,
        breakMinutes: entry.breakMinutes,
        scheduledNetMinutes: entry.scheduledNetMinutes,
        timezone: entry.timezone,
        dayType: entry.dayType,
        dayPortion: entry.dayPortion,
        source: entry.source,
        generationKey: entry.generationKey,
        businessCalendarRuntimeDayId:
          entry.businessCalendarRuntimeDayId ?? null,
      };

      if (entry.action === 'create') {
        await tx.shiftRosterEntry.create({
          data: { ...data, shiftRosterId: rosterId },
        });
      } else if (entry.action === 'update' && entry.existingEntryId) {
        await tx.shiftRosterEntry.update({
          where: { id: entry.existingEntryId },
          data,
        });
      }
    }
  }

  private async assertNoPublishedOverlap(
    tx: PrismaTx,
    roster: {
      id: string;
      branchId: string;
      periodStart: Date;
      periodEnd: Date;
    },
  ) {
    const periodStart = parseCalendarDateInput(roster.periodStart);
    const periodEnd = parseCalendarDateInput(roster.periodEnd);

    const overlaps = await tx.shiftRoster.findMany({
      where: {
        branchId: roster.branchId,
        id: { not: roster.id },
        status: { in: [ShiftRosterStatus.PUBLISHED, ShiftRosterStatus.LOCKED] },
      },
      select: { id: true, periodStart: true, periodEnd: true, status: true },
    });

    const conflict = overlaps.find((candidate) =>
      calendarRangesOverlap(
        periodStart,
        periodEnd,
        parseCalendarDateInput(candidate.periodStart),
        parseCalendarDateInput(candidate.periodEnd),
      ),
    );

    if (conflict) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.ROSTER_OVERLAP,
        message: 'Another published or locked roster overlaps this period',
      });
    }
  }

  private async loadBranch(branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        ...this.employeeDomainScope.branchWhere(),
      },
      include: { workingDays: true, company: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async loadGenerationContext(
    branchId: string,
    periodStart: string,
    periodEnd: string,
    rosterId: string,
    existingEntries: Array<{
      id: string;
      employeeId: string;
      workDate: Date;
      dayType: Prisma.ShiftRosterEntryCreateInput['dayType'];
      dayPortion: Prisma.ShiftRosterEntryCreateInput['dayPortion'];
      shiftId: string | null;
      scheduledStartAt: Date | null;
      scheduledEndAt: Date | null;
      breakMinutes: number;
      scheduledNetMinutes: number;
      timezone: string;
      source: ShiftRosterEntrySource;
      businessCalendarRuntimeDayId?: string | null;
    }> = [],
  ) {
    const branch = await this.loadBranch(branchId);
    const timezone = branch.timezone?.trim() ?? '';

    const employees = await this.prisma.employee.findMany({
      where: {
        branchId,
        isActive: true,
        ...this.employeeDomainScope.employeeWhere(),
      },
      select: {
        id: true,
        joiningDate: true,
        separations: {
          where: { status: { in: ['APPROVED', 'COMPLETED'] } },
          select: { lastWorkingDate: true },
          orderBy: { lastWorkingDate: 'desc' },
          take: 1,
        },
      },
    });

    const office = await this.calendarConsumer.resolveOfficeRuntimeMode(
      branch.companyId,
      branch.id,
    );

    let holidays: Awaited<ReturnType<typeof this.prisma.holiday.findMany>> = [];
    let runtimeDays:
      | Map<
          string,
          {
            dayType: ShiftRosterDayType;
            dayPortion: DayPortion;
            runtimeDayId: string | null;
          }
        >
      | undefined;

    /**
     * Prefer published business-calendar days whenever an office calendar exists.
     * Runtime is already materialized on publish; gating only on ACTIVE left
     * LEGACY offices ignoring published holidays (Quick day check vs roster mismatch).
     */
    if (office.calendarId) {
      try {
        const resolved = await this.calendarConsumer.resolveConsumerDays({
          companyId: branch.companyId,
          branchId: branch.id,
          from: periodStart,
          to: periodEnd,
        });
        runtimeDays = new Map(
          [...resolved.entries()].map(([date, day]) => {
            const mapped = this.calendarConsumer.mapRosterDayType(day);
            return [
              date,
              {
                dayType: mapped.dayType,
                dayPortion: mapped.dayPortion,
                runtimeDayId: day.runtimeDayId,
              },
            ];
          }),
        );
      } catch {
        runtimeDays = undefined;
      }
    }

    if (!runtimeDays) {
      holidays = await this.prisma.holiday.findMany({
        where: {
          isActive: true,
          holidayDate: {
            gte: calendarDateToDbDate(periodStart),
            lte: calendarDateToDbDate(periodEnd),
          },
          OR: [{ branchId }, { branchId: null, companyId: branch.companyId }],
          ...this.employeeDomainScope.holidayWhere(),
        },
      });
    }

    const employeeShifts = await this.prisma.employeeShift.findMany({
      where: {
        isActive: true,
        employee: {
          branchId,
          isActive: true,
          ...this.employeeDomainScope.employeeWhere(),
        },
        effectiveFrom: { lte: calendarDateToDbDate(periodEnd) },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: calendarDateToDbDate(periodStart) } },
        ],
      },
      include: { shift: true },
    });

    const defaultShift =
      (await this.prisma.shift.findFirst({
        where: {
          companyId: branch.companyId,
          isActive: true,
          isDefault: true,
        },
      })) ??
      (await this.prisma.shift.findFirst({
        where: {
          companyId: branch.companyId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      }));

    return {
      branch: {
        id: branch.id,
        companyId: branch.companyId,
        timezone,
        workingCalendarReviewedAt: branch.workingCalendarReviewedAt,
        workingDays: branch.workingDays,
      },
      periodStart,
      periodEnd,
      rosterId,
      employees: employees.map((employee) => ({
        id: employee.id,
        joiningDate: employee.joiningDate,
        lastWorkingDate: employee.separations[0]?.lastWorkingDate
          ? parseCalendarDateInput(employee.separations[0].lastWorkingDate)
          : null,
      })),
      holidays,
      runtimeDays,
      employeeShifts: employeeShifts.map((assignment) => ({
        employeeId: assignment.employeeId,
        shift: assignment.shift,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
      })),
      defaultShift,
      existingEntries,
    };
  }

  private async findDraftRoster(id: string, tx?: PrismaTx) {
    const db = tx ?? this.prisma;
    const roster = await db.shiftRoster.findFirst({
      where: {
        id,
        status: ShiftRosterStatus.DRAFT,
        ...this.employeeDomainScope.shiftRosterWhere(),
      },
      include: { entries: true },
    });

    if (!roster) {
      throw new NotFoundException('Draft shift roster not found');
    }

    return roster;
  }

  private rosterInclude() {
    return {
      company: { select: { id: true, companyCode: true, companyName: true } },
      branch: { select: { id: true, branchCode: true, branchName: true } },
      createdByUser: {
        select: { id: true, username: true, displayName: true },
      },
      publishedByUser: {
        select: { id: true, username: true, displayName: true },
      },
      lockedByUser: { select: { id: true, username: true, displayName: true } },
      archivedByUser: {
        select: { id: true, username: true, displayName: true },
      },
    } as const;
  }

  private entrySnapshot(entry: {
    shiftId: string | null;
    scheduledStartAt: Date | null;
    scheduledEndAt: Date | null;
    breakMinutes: number;
    scheduledNetMinutes: number;
    dayType: string;
    dayPortion: string;
    timezone: string;
  }) {
    return {
      shiftId: entry.shiftId,
      scheduledStartAt: entry.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: entry.scheduledEndAt?.toISOString() ?? null,
      breakMinutes: entry.breakMinutes,
      scheduledNetMinutes: entry.scheduledNetMinutes,
      dayType: entry.dayType,
      dayPortion: entry.dayPortion,
      timezone: entry.timezone,
    };
  }
}
