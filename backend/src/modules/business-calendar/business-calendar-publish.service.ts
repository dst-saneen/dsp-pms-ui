import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { BusinessCalendarVersionStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkforceNotificationEventCode } from '../notification/notification-event.catalog';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import {
  buildVersionChecksumPayload,
  computeVersionContentChecksum,
} from './business-calendar-checksum.util';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { BusinessCalendarRuntimeService } from './business-calendar-runtime.service';
import {
  addMonthsUtc,
  eachDateInclusive,
  resolveBusinessDay,
} from './business-calendar-runtime.util';
import { BusinessCalendarVersionService } from './business-calendar-version.service';
import {
  PreviewImpactDto,
  PublishCalendarVersionDto,
  StartAmendmentDto,
} from './dto/business-calendar-publish.dto';

const OPTIONAL_HOLIDAY_OPENED_RECIPIENT_PAGE = 500;

function calendarPublishLockKey(calendarId: string): string {
  return `business-calendar-publish:${calendarId}`;
}

@Injectable()
export class BusinessCalendarPublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: BusinessCalendarVersionService,
    private readonly runtime: BusinessCalendarRuntimeService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async startAmendment(
    publishedVersionId: string,
    dto: StartAmendmentDto,
    actorUserId: string,
  ) {
    const source = await this.versions.requireVersion(publishedVersionId);
    if (source.status !== BusinessCalendarVersionStatus.PUBLISHED) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_AMENDMENT_REQUIRED,
        message: 'Amendments can only start from a PUBLISHED version',
      });
    }

    const effectiveDate = this.parseDate(dto.effectiveDate);
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Amendment reason is required');
    }

    const full = await this.prisma.businessCalendarVersion.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        workingWeekRules: true,
        events: { include: { targets: true } },
      },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${calendarPublishLockKey(source.calendarId)}, 0))`,
      );

      const openAmendment = await tx.businessCalendarVersion.findFirst({
        where: {
          calendarId: source.calendarId,
          amendsVersionId: source.id,
          status: {
            in: [
              BusinessCalendarVersionStatus.DRAFT,
              BusinessCalendarVersionStatus.IN_REVIEW,
            ],
          },
        },
      });
      if (openAmendment) {
        throw new ConflictException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_CONFLICT,
          message:
            'An open amendment already exists for this published version',
        });
      }

      const latest = await tx.businessCalendarVersion.findFirst({
        where: { calendarId: source.calendarId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;

      const checksum = computeVersionContentChecksum(
        buildVersionChecksumPayload({
          effectiveFrom: effectiveDate,
          effectiveTo: full.effectiveTo,
          workingWeekRules: full.workingWeekRules,
          events: full.events,
        }),
      );

      const draft = await tx.businessCalendarVersion.create({
        data: {
          calendarId: source.calendarId,
          versionNumber,
          status: BusinessCalendarVersionStatus.DRAFT,
          effectiveFrom: effectiveDate,
          effectiveTo: full.effectiveTo,
          amendsVersionId: source.id,
          changeReason: reason,
          contentChecksum: checksum,
          createdByUserId: actorUserId,
          workingWeekRules: {
            create: full.workingWeekRules.map((rule) => ({
              dayOfWeek: rule.dayOfWeek,
              ruleMode: rule.ruleMode,
              isWorkingDay: rule.isWorkingDay,
              dayPortion: rule.dayPortion,
              reason: rule.reason,
            })),
          },
        },
      });

      for (const event of full.events) {
        await tx.businessCalendarEvent.create({
          data: {
            calendarVersionId: draft.id,
            companyId: event.companyId,
            eventTypeId: event.eventTypeId,
            eventCategoryId: event.eventCategoryId,
            eventSourceId: event.eventSourceId,
            eventCode: event.eventCode,
            eventName: event.eventName,
            description: event.description,
            allDay: event.allDay,
            startDate: event.startDate,
            endDate: event.endDate,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            eventTimezone: event.eventTimezone,
            businessDayEffect: event.businessDayEffect,
            paidHoliday: event.paidHoliday,
            isOptionalHoliday: event.isOptionalHoliday,
            isProtected: event.isProtected,
            externalReference: event.externalReference,
            sourcePayloadHash: event.sourcePayloadHash,
            createdByUserId: actorUserId,
            targets: {
              create: event.targets.map((target) => ({
                targetType: target.targetType,
                companyId: target.companyId,
                branchId: target.branchId,
                departmentId: target.departmentId,
                employeeId: target.employeeId,
                projectId: target.projectId,
              })),
            },
          },
        });
      }

      await this.versions.refreshChecksum(tx, draft.id);

      await this.auditService.log(
        'BusinessCalendarVersion',
        draft.id,
        'START_AMENDMENT',
        undefined,
        {
          amendsVersionId: source.id,
          effectiveDate: dto.effectiveDate,
          reason,
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarVersion',
        aggregateId: draft.id,
        eventType: 'business_calendar_version.amendment_started',
        dedupeKey: `business_calendar_version.amendment_started:${draft.id}`,
        companyId: source.calendar.companyId,
        branchId: source.calendar.branchId,
        payload: {
          previousVersionId: source.id,
          amendmentVersionId: draft.id,
        },
      });

      return draft.id;
    });

    return this.versions.getVersion(created);
  }

  async previewImpact(versionId: string, dto: PreviewImpactDto) {
    const version = await this.versions.requireVersion(versionId);
    if (!version.amendsVersionId) {
      return {
        isAmendment: false,
        required: false,
        changedDates: [] as string[],
        changedDateCount: 0,
        openLeaveCount: 0,
        openRosterCount: 0,
        impacts: [] as Array<Record<string, unknown>>,
        message: 'Impact preview is only required for amendment versions',
      };
    }

    const previous = await this.versions.requireVersion(
      version.amendsVersionId,
    );
    const from = dto.from ? this.parseDate(dto.from) : version.effectiveFrom;
    const to = dto.to
      ? this.parseDate(dto.to)
      : (version.effectiveTo ?? addMonthsUtc(from, 18));

    const [currentBundle, previousBundle] = await Promise.all([
      this.loadCompareBundle(version.id),
      this.loadCompareBundle(previous.id),
    ]);

    const changedDates: string[] = [];
    for (const businessDate of eachDateInclusive(from, to)) {
      const isBranch = version.calendar.scope === 'BRANCH';
      const next = resolveBusinessDay({
        companyId: version.calendar.companyId,
        branchId: version.calendar.branchId,
        businessDate,
        companyWeekRules: isBranch ? [] : currentBundle.week,
        companyEvents: isBranch ? [] : currentBundle.events,
        branchWeekRules: isBranch ? currentBundle.week : undefined,
        branchEvents: isBranch ? currentBundle.events : undefined,
        sourceChecksum: currentBundle.checksum,
      });
      const prev = resolveBusinessDay({
        companyId: version.calendar.companyId,
        branchId: version.calendar.branchId,
        businessDate,
        companyWeekRules: isBranch ? [] : previousBundle.week,
        companyEvents: isBranch ? [] : previousBundle.events,
        branchWeekRules: isBranch ? previousBundle.week : undefined,
        branchEvents: isBranch ? previousBundle.events : undefined,
        sourceChecksum: previousBundle.checksum,
      });

      if (
        next.dayStatus !== prev.dayStatus ||
        next.dayPortion !== prev.dayPortion
      ) {
        changedDates.push(businessDate.toISOString().slice(0, 10));
      }
    }

    const dateFilter =
      changedDates.length > 0
        ? {
            gte: this.parseDate(changedDates[0]),
            lte: this.parseDate(changedDates[changedDates.length - 1]),
          }
        : null;

    let openLeaveCount = 0;
    let openRosterCount = 0;
    const impacts: Array<Record<string, unknown>> = [];

    if (dateFilter && changedDates.length > 0) {
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          status: { in: ['PENDING', 'APPROVED', 'SUBMITTED'] },
          fromDate: { lte: dateFilter.lte },
          toDate: { gte: dateFilter.gte },
          employee: {
            companyId: version.calendar.companyId,
            ...(version.calendar.branchId
              ? { branchId: version.calendar.branchId }
              : {}),
          },
        },
        select: { id: true, fromDate: true, toDate: true, status: true },
        take: 100,
      });
      openLeaveCount = leaves.length;
      for (const leave of leaves) {
        impacts.push({
          entityType: 'LeaveRequest',
          entityId: leave.id,
          impactCode: 'LEAVE_REVIEW',
          impactSummary: `Leave ${leave.status} may need review after calendar amendment`,
          businessDate: leave.fromDate.toISOString().slice(0, 10),
        });
      }

      const rosters = await this.prisma.shiftRosterEntry.findMany({
        where: {
          companyId: version.calendar.companyId,
          ...(version.calendar.branchId
            ? { branchId: version.calendar.branchId }
            : {}),
          workDate: { gte: dateFilter.gte, lte: dateFilter.lte },
        },
        select: { id: true, workDate: true },
        take: 100,
      });
      openRosterCount = rosters.length;
      for (const roster of rosters) {
        impacts.push({
          entityType: 'ShiftRoster',
          entityId: roster.id,
          impactCode: 'ROSTER_REVIEW',
          impactSummary: 'Shift roster entry overlaps amended calendar dates',
          businessDate: roster.workDate.toISOString().slice(0, 10),
        });
      }
    }

    return {
      isAmendment: true,
      required: true,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      changedDates,
      changedDateCount: changedDates.length,
      openLeaveCount,
      openRosterCount,
      impacts,
      previousChecksum: previous.contentChecksum,
      newChecksum: version.contentChecksum,
    };
  }

  async publish(
    versionId: string,
    dto: PublishCalendarVersionDto,
    actorUserId: string,
  ) {
    const current = await this.versions.requireVersion(versionId);
    if (
      current.status !== BusinessCalendarVersionStatus.IN_REVIEW &&
      current.status !== BusinessCalendarVersionStatus.DRAFT
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Only DRAFT or IN_REVIEW versions can be published',
      });
    }

    if (
      dto.optimisticVersion != null &&
      dto.optimisticVersion !== current.optimisticVersion
    ) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_STALE_VERSION,
        message: 'Version was updated by another user; refresh and retry',
      });
    }

    const summary = this.versions.buildValidationSummary(current);
    if (!summary.readyForReview) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_WORKING_WEEK_INCOMPLETE,
        message: summary.issues.join('; ') || 'Version is not ready to publish',
        issues: summary.issues,
      });
    }

    let impactPreview: Awaited<ReturnType<typeof this.previewImpact>> | null =
      null;
    if (current.amendsVersionId) {
      if (!dto.impactPreviewAcknowledged) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_IMPACT_REVIEW_REQUIRED,
          message:
            'Amendment publish requires impactPreviewAcknowledged=true after preview-impact',
        });
      }
      impactPreview = await this.previewImpact(versionId, {});
    }

    const materializeTo = dto.materializeTo
      ? this.parseDate(dto.materializeTo)
      : this.runtime.defaultMaterializeTo(
          current.effectiveFrom,
          current.effectiveTo,
        );

    // Keep the publish transaction short. Materializing a full year of runtime
    // days inside the interactive transaction exceeds Prisma's default timeout
    // (P2028) on shared RDS. Runtime rebuild is idempotent after commit.
    const published = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${calendarPublishLockKey(current.calendarId)}, 0))`,
        );

        const fresh = await tx.businessCalendarVersion.findUniqueOrThrow({
          where: { id: current.id },
        });
        if (
          fresh.status === BusinessCalendarVersionStatus.PUBLISHED ||
          (dto.optimisticVersion != null &&
            fresh.optimisticVersion !== dto.optimisticVersion)
        ) {
          throw new ConflictException({
            code: BusinessCalendarErrorCode.CALENDAR_STALE_VERSION,
            message: 'Concurrent publish detected; refresh and retry',
          });
        }

        await this.assertNoPublishedOverlap(
          tx,
          current.calendarId,
          current.effectiveFrom,
          current.effectiveTo,
          current.id,
          current.amendsVersionId,
        );

        // Close / replace the prior published version for this amendment.
        // - Mid-year amendment (starts after previous start): keep previous
        //   PUBLISHED with a shortened effectiveTo so earlier dates stay covered.
        // - Same-or-earlier start: full replace → SUPERSEDED (never invert dates).
        if (current.amendsVersionId) {
          const previous = await tx.businessCalendarVersion.findUniqueOrThrow({
            where: { id: current.amendsVersionId },
            select: { effectiveFrom: true },
          });
          const dayBeforeAmendment = new Date(
            current.effectiveFrom.getTime() - 24 * 60 * 60 * 1000,
          );
          const fullyReplaced =
            current.effectiveFrom.getTime() <= previous.effectiveFrom.getTime();

          if (fullyReplaced) {
            await tx.businessCalendarVersion.update({
              where: { id: current.amendsVersionId },
              data: {
                status: BusinessCalendarVersionStatus.SUPERSEDED,
                supersededAt: new Date(),
                effectiveTo: previous.effectiveFrom,
              },
            });
          } else {
            await tx.businessCalendarVersion.update({
              where: { id: current.amendsVersionId },
              data: {
                // Stay PUBLISHED for the truncated earlier window.
                effectiveTo: dayBeforeAmendment,
                supersededAt: null,
              },
            });
          }
        }

        const version = await tx.businessCalendarVersion.update({
          where: { id: current.id },
          data: {
            status: BusinessCalendarVersionStatus.PUBLISHED,
            publishedByUserId: actorUserId,
            publishedAt: new Date(),
            optimisticVersion: { increment: 1 },
          },
          include: this.versions.versionSummaryInclude(),
        });

        let amendmentId: string | null = null;
        if (current.amendsVersionId && impactPreview) {
          const amendment = await tx.businessCalendarAmendment.create({
            data: {
              calendarId: current.calendarId,
              previousVersionId: current.amendsVersionId,
              amendmentVersionId: version.id,
              effectiveDate: current.effectiveFrom,
              reason: current.changeReason || 'Amendment published',
              previousChecksum: impactPreview.previousChecksum ?? '',
              newChecksum: version.contentChecksum,
              impactSummary: {
                changedDateCount: impactPreview.changedDateCount,
                openLeaveCount: impactPreview.openLeaveCount,
                openRosterCount: impactPreview.openRosterCount,
              },
              createdByUserId: actorUserId,
              publishedByUserId: actorUserId,
              publishedAt: new Date(),
              impacts: {
                create: impactPreview.impacts.slice(0, 200).map((impact) => ({
                  companyId: current.calendar.companyId,
                  branchId: current.calendar.branchId,
                  businessDate: this.parseDate(String(impact.businessDate)),
                  entityType: String(impact.entityType),
                  entityId: String(impact.entityId),
                  impactCode: String(impact.impactCode),
                  impactSummary: String(impact.impactSummary),
                })),
              },
            },
          });
          amendmentId = amendment.id;
        }

        await this.auditService.log(
          'BusinessCalendarVersion',
          version.id,
          'PUBLISH',
          { status: current.status },
          { status: version.status, amendmentId },
          { userId: actorUserId, tx },
        );

        await this.outboxWriter.write(tx, {
          aggregateType: 'BusinessCalendarVersion',
          aggregateId: version.id,
          eventType: 'business_calendar_version.published',
          dedupeKey: `business_calendar_version.published:${version.id}`,
          companyId: current.calendar.companyId,
          branchId: current.calendar.branchId,
          payload: {
            calendarId: current.calendarId,
            versionId: version.id,
            amendmentId,
          },
        });

        const publishedEvents = await tx.businessCalendarEvent.findMany({
          where: { calendarVersionId: version.id },
          select: { isOptionalHoliday: true, startDate: true },
        });
        await this.notifyOptionalHolidaySelectionOpened(tx, {
          versionId: version.id,
          companyId: current.calendar.companyId,
          branchId: current.calendar.branchId,
          scope: current.calendar.scope,
          events: publishedEvents,
        });

        const officeScopeKey = (
          await tx.businessCalendar.findUniqueOrThrow({
            where: { id: current.calendarId },
          })
        ).scopeKey;

        return { version, amendmentId, officeScopeKey };
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );

    const materialize = await this.runtime
      .materializeRange({
        companyId: current.calendar.companyId,
        branchId: current.calendar.branchId,
        calendarId: current.calendarId,
        officeScopeKey: published.officeScopeKey,
        timezone: current.calendar.defaultTimezone,
        from: current.effectiveFrom,
        to: materializeTo,
      })
      .then((result) => ({
        written: result.written,
        skipped: result.skipped,
      }))
      .catch((error: unknown) => ({
        written: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : 'Materialize failed',
      }));

    return {
      ...this.versions.withValidationSummary(published.version),
      amendmentId: published.amendmentId,
      impactPreview,
      materialize,
    };
  }

  private async assertNoPublishedOverlap(
    tx: Prisma.TransactionClient,
    calendarId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeVersionId: string,
    alsoExcludeVersionId?: string | null,
  ) {
    const excludeIds = [excludeVersionId, alsoExcludeVersionId].filter(
      Boolean,
    ) as string[];
    const published = await tx.businessCalendarVersion.findMany({
      where: {
        calendarId,
        status: BusinessCalendarVersionStatus.PUBLISHED,
        id: { notIn: excludeIds },
      },
      select: {
        id: true,
        versionNumber: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    for (const row of published) {
      const overlaps = this.rangesOverlap(
        effectiveFrom,
        effectiveTo,
        row.effectiveFrom,
        row.effectiveTo,
      );
      if (overlaps) {
        throw new ConflictException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_OVERLAP,
          message: `Published effective range overlaps version ${row.versionNumber}`,
        });
      }
    }
  }

  private rangesOverlap(
    aFrom: Date,
    aTo: Date | null,
    bFrom: Date,
    bTo: Date | null,
  ): boolean {
    const aEnd = aTo ?? new Date('9999-12-31T00:00:00.000Z');
    const bEnd = bTo ?? new Date('9999-12-31T00:00:00.000Z');
    return aFrom <= bEnd && bFrom <= aEnd;
  }

  private async loadCompareBundle(versionId: string) {
    const version = await this.prisma.businessCalendarVersion.findUniqueOrThrow(
      {
        where: { id: versionId },
        include: {
          workingWeekRules: true,
          events: { include: { targets: true } },
        },
      },
    );
    return {
      checksum: version.contentChecksum,
      week: version.workingWeekRules.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        isWorkingDay: rule.isWorkingDay,
        dayPortion: rule.dayPortion,
        ruleMode: rule.ruleMode,
      })),
      events: version.events.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        startDate: event.startDate,
        endDate: event.endDate,
        businessDayEffect: event.businessDayEffect,
        paidHoliday: event.paidHoliday,
        isOptionalHoliday: event.isOptionalHoliday,
        targets: event.targets.map((target) => ({
          targetType: target.targetType,
          companyId: target.companyId,
          branchId: target.branchId,
        })),
      })),
    };
  }

  private async notifyOptionalHolidaySelectionOpened(
    tx: Prisma.TransactionClient,
    input: {
      versionId: string;
      companyId: string;
      branchId: string | null;
      scope: string;
      events: Array<{ isOptionalHoliday: boolean; startDate: Date }>;
    },
  ): Promise<void> {
    const optionalEvents = input.events.filter(
      (event) => event.isOptionalHoliday,
    );
    if (optionalEvents.length === 0) {
      return;
    }

    const years = [
      ...new Set(
        optionalEvents.map((event) => event.startDate.getUTCFullYear()),
      ),
    ];
    const policy = await tx.companyHolidayPolicy.findFirst({
      where: {
        companyId: input.companyId,
        year: { in: years },
        isActive: true,
      },
      select: { id: true },
    });
    if (!policy) {
      return;
    }

    const recipientUserIds: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const users = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          employee: {
            isActive: true,
            companyId: input.companyId,
            ...(input.scope === 'BRANCH' && input.branchId
              ? { branchId: input.branchId }
              : {}),
          },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: OPTIONAL_HOLIDAY_OPENED_RECIPIENT_PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (users.length === 0) {
        break;
      }
      recipientUserIds.push(...users.map((user) => user.id));
      cursor = users[users.length - 1]?.id;
      if (users.length < OPTIONAL_HOLIDAY_OPENED_RECIPIENT_PAGE) {
        break;
      }
    }

    if (recipientUserIds.length === 0) {
      return;
    }

    const eventCode =
      WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_SELECTION_OPENED;
    await this.outboxWriter.write(tx, {
      aggregateType: 'BusinessCalendarVersion',
      aggregateId: input.versionId,
      eventType: eventCode,
      dedupeKey: `${eventCode}:${input.versionId}`,
      companyId: input.companyId,
      branchId: input.branchId,
      payload: {
        companyId: input.companyId,
        branchId: input.branchId,
        eventCode,
        recipientUserIds,
      },
    });
  }

  private parseDate(value: string | Date): Date {
    if (value instanceof Date) {
      return new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate(),
        ),
      );
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
