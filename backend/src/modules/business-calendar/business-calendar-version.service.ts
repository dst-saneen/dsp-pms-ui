import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarRuleMode,
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  DayPortion,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import {
  buildVersionChecksumPayload,
  computeVersionContentChecksum,
} from './business-calendar-checksum.util';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import {
  CreateCalendarVersionDto,
  ReplaceWorkingWeekDto,
  UpdateCalendarVersionDto,
  VersionTransitionDto,
} from './dto/business-calendar-version.dto';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class BusinessCalendarVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async listVersions(calendarId: string) {
    const calendar = await this.requireCalendar(calendarId);
    const versions = await this.prisma.businessCalendarVersion.findMany({
      where: { calendarId: calendar.id },
      include: this.versionSummaryInclude(),
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((version) => this.withValidationSummary(version));
  }

  async getVersion(versionId: string) {
    const version = await this.requireVersion(versionId);
    return this.withValidationSummary(version);
  }

  async createVersion(
    calendarId: string,
    dto: CreateCalendarVersionDto,
    actorUserId: string,
  ) {
    const calendar = await this.requireCalendar(calendarId);
    const effectiveFrom = this.parseDateOnly(
      dto.effectiveFrom,
      'effectiveFrom',
    );
    const effectiveTo = dto.effectiveTo
      ? this.parseDateOnly(dto.effectiveTo, 'effectiveTo')
      : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_CONFLICT,
        message: 'effectiveTo cannot precede effectiveFrom',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.businessCalendarVersion.findFirst({
        where: { calendarId: calendar.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const checksum = computeVersionContentChecksum(
        buildVersionChecksumPayload({
          effectiveFrom,
          effectiveTo,
          workingWeekRules: [],
          events: [],
        }),
      );

      const version = await tx.businessCalendarVersion.create({
        data: {
          calendarId: calendar.id,
          versionNumber,
          status: BusinessCalendarVersionStatus.DRAFT,
          effectiveFrom,
          effectiveTo,
          changeReason: dto.changeReason?.trim() || null,
          contentChecksum: checksum,
          createdByUserId: actorUserId,
        },
      });

      await this.auditService.log(
        'BusinessCalendarVersion',
        version.id,
        'CREATE',
        undefined,
        {
          calendarId: calendar.id,
          versionNumber,
          status: version.status,
          effectiveFrom: dto.effectiveFrom,
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarVersion',
        aggregateId: version.id,
        eventType: 'business_calendar_version.created',
        dedupeKey: `business_calendar_version.created:${version.id}`,
        companyId: calendar.companyId,
        branchId: calendar.branchId,
        payload: {
          calendarId: calendar.id,
          versionNumber,
          status: version.status,
        },
      });

      return tx.businessCalendarVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: this.versionSummaryInclude(),
      });
    });

    return this.withValidationSummary(created);
  }

  async updateVersion(
    versionId: string,
    dto: UpdateCalendarVersionDto,
    actorUserId: string,
  ) {
    const current = await this.requireVersion(versionId);
    this.assertDraftEditable(current);

    if (
      dto.optimisticVersion != null &&
      dto.optimisticVersion !== current.optimisticVersion
    ) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_STALE_VERSION,
        message: 'Version was updated by another user; refresh and retry',
      });
    }

    const effectiveFrom = dto.effectiveFrom
      ? this.parseDateOnly(dto.effectiveFrom, 'effectiveFrom')
      : current.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo === undefined
        ? current.effectiveTo
        : dto.effectiveTo === null
          ? null
          : this.parseDateOnly(dto.effectiveTo, 'effectiveTo');
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_CONFLICT,
        message: 'effectiveTo cannot precede effectiveFrom',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const version = await tx.businessCalendarVersion.update({
        where: { id: current.id },
        data: {
          effectiveFrom,
          effectiveTo,
          changeReason:
            dto.changeReason === undefined
              ? undefined
              : dto.changeReason?.trim() || null,
          optimisticVersion: { increment: 1 },
        },
      });

      await this.refreshChecksum(tx, version.id);

      await this.auditService.log(
        'BusinessCalendarVersion',
        version.id,
        'UPDATE',
        {
          effectiveFrom: current.effectiveFrom,
          effectiveTo: current.effectiveTo,
          changeReason: current.changeReason,
        },
        {
          effectiveFrom: version.effectiveFrom,
          effectiveTo: version.effectiveTo,
          changeReason: version.changeReason,
        },
        { userId: actorUserId, tx },
      );

      return tx.businessCalendarVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: this.versionSummaryInclude(),
      });
    });

    return this.withValidationSummary(updated);
  }

  async replaceWorkingWeek(
    versionId: string,
    dto: ReplaceWorkingWeekDto,
    actorUserId: string,
  ) {
    const current = await this.requireVersion(versionId);
    this.assertDraftEditable(current);

    if (
      dto.optimisticVersion != null &&
      dto.optimisticVersion !== current.optimisticVersion
    ) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_STALE_VERSION,
        message: 'Version was updated by another user; refresh and retry',
      });
    }

    const scope = current.calendar.scope;
    this.validateWorkingWeekRules(scope, dto.rules);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.businessCalendarWorkingWeekRule.deleteMany({
        where: { calendarVersionId: current.id },
      });

      if (dto.rules.length > 0) {
        await tx.businessCalendarWorkingWeekRule.createMany({
          data: dto.rules.map((rule) => ({
            calendarVersionId: current.id,
            dayOfWeek: rule.dayOfWeek,
            ruleMode: rule.ruleMode,
            isWorkingDay: rule.isWorkingDay,
            dayPortion: rule.dayPortion ?? DayPortion.FULL_DAY,
            reason: rule.reason?.trim() || null,
          })),
        });
      }

      await tx.businessCalendarVersion.update({
        where: { id: current.id },
        data: { optimisticVersion: { increment: 1 } },
      });

      await this.refreshChecksum(tx, current.id);

      await this.auditService.log(
        'BusinessCalendarVersion',
        current.id,
        'WORKING_WEEK_REPLACE',
        undefined,
        {
          ruleCount: dto.rules.length,
          days: dto.rules.map((rule) => rule.dayOfWeek),
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarVersion',
        aggregateId: current.id,
        eventType: 'business_calendar_version.working_week_updated',
        dedupeKey: `business_calendar_version.working_week_updated:${current.id}:${Date.now()}`,
        companyId: current.calendar.companyId,
        branchId: current.calendar.branchId,
        payload: {
          versionId: current.id,
          ruleCount: dto.rules.length,
        },
      });

      return tx.businessCalendarVersion.findUniqueOrThrow({
        where: { id: current.id },
        include: this.versionSummaryInclude(),
      });
    });

    return this.withValidationSummary(updated);
  }

  async submitReview(
    versionId: string,
    dto: VersionTransitionDto,
    actorUserId: string,
  ) {
    const current = await this.requireVersion(versionId);
    if (current.status !== BusinessCalendarVersionStatus.DRAFT) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Only DRAFT versions can be submitted for review',
      });
    }
    this.assertOptimistic(current.optimisticVersion, dto.optimisticVersion);

    const summary = this.buildValidationSummary(current);
    if (!summary.readyForReview) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_WORKING_WEEK_INCOMPLETE,
        message: summary.issues.join('; ') || 'Version is not ready for review',
        issues: summary.issues,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const version = await tx.businessCalendarVersion.update({
        where: { id: current.id },
        data: {
          status: BusinessCalendarVersionStatus.IN_REVIEW,
          submittedByUserId: actorUserId,
          submittedAt: new Date(),
          optimisticVersion: { increment: 1 },
        },
        include: this.versionSummaryInclude(),
      });

      await this.auditService.log(
        'BusinessCalendarVersion',
        version.id,
        'SUBMIT_REVIEW',
        { status: current.status },
        { status: version.status },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarVersion',
        aggregateId: version.id,
        eventType: 'business_calendar_version.submitted',
        dedupeKey: `business_calendar_version.submitted:${version.id}:${version.optimisticVersion}`,
        companyId: current.calendar.companyId,
        branchId: current.calendar.branchId,
        payload: { versionId: version.id, status: version.status },
      });

      return version;
    });

    return this.withValidationSummary(updated);
  }

  async returnDraft(
    versionId: string,
    dto: VersionTransitionDto,
    actorUserId: string,
  ) {
    const current = await this.requireVersion(versionId);
    if (current.status !== BusinessCalendarVersionStatus.IN_REVIEW) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Only IN_REVIEW versions can be returned to draft',
      });
    }
    this.assertOptimistic(current.optimisticVersion, dto.optimisticVersion);

    const updated = await this.prisma.$transaction(async (tx) => {
      const version = await tx.businessCalendarVersion.update({
        where: { id: current.id },
        data: {
          status: BusinessCalendarVersionStatus.DRAFT,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
          optimisticVersion: { increment: 1 },
        },
        include: this.versionSummaryInclude(),
      });

      await this.auditService.log(
        'BusinessCalendarVersion',
        version.id,
        'RETURN_DRAFT',
        { status: current.status },
        { status: version.status },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarVersion',
        aggregateId: version.id,
        eventType: 'business_calendar_version.returned_draft',
        dedupeKey: `business_calendar_version.returned_draft:${version.id}:${version.optimisticVersion}`,
        companyId: current.calendar.companyId,
        branchId: current.calendar.branchId,
        payload: { versionId: version.id, status: version.status },
      });

      return version;
    });

    return this.withValidationSummary(updated);
  }

  async refreshChecksum(tx: TxClient, versionId: string) {
    const version = await tx.businessCalendarVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        workingWeekRules: true,
        events: { include: { targets: true } },
      },
    });

    const checksum = computeVersionContentChecksum(
      buildVersionChecksumPayload({
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
        workingWeekRules: version.workingWeekRules,
        events: version.events,
      }),
    );

    await tx.businessCalendarVersion.update({
      where: { id: versionId },
      data: { contentChecksum: checksum },
    });

    return checksum;
  }

  assertDraftEditable(version: { status: BusinessCalendarVersionStatus }) {
    if (version.status === BusinessCalendarVersionStatus.PUBLISHED) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_AMENDMENT_REQUIRED,
        message:
          'Published versions are immutable; start an amendment version (Stage 4)',
      });
    }
    if (version.status !== BusinessCalendarVersionStatus.DRAFT) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Only DRAFT versions can be edited',
      });
    }
  }

  private assertOptimistic(current: number, provided?: number) {
    if (provided != null && provided !== current) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_STALE_VERSION,
        message: 'Version was updated by another user; refresh and retry',
      });
    }
  }

  validateWorkingWeekRules(
    scope: BusinessCalendarScope,
    rules: ReplaceWorkingWeekDto['rules'],
  ) {
    const days = new Set<number>();
    for (const rule of rules) {
      if (days.has(rule.dayOfWeek)) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_CONFLICT,
          message: `Duplicate working-week rule for day ${rule.dayOfWeek}`,
        });
      }
      days.add(rule.dayOfWeek);

      if (scope === BusinessCalendarScope.COMPANY) {
        if (rule.ruleMode !== BusinessCalendarRuleMode.DEFINE) {
          throw new BadRequestException({
            code: BusinessCalendarErrorCode.CALENDAR_WORKING_WEEK_INCOMPLETE,
            message: 'Company calendars must use DEFINE rule mode',
          });
        }
      } else {
        if (rule.ruleMode !== BusinessCalendarRuleMode.OVERRIDE) {
          throw new BadRequestException({
            code: BusinessCalendarErrorCode.CALENDAR_WORKING_WEEK_INCOMPLETE,
            message: 'Branch calendars must use OVERRIDE rule mode',
          });
        }
        if (!rule.reason?.trim()) {
          throw new BadRequestException({
            code: BusinessCalendarErrorCode.CALENDAR_WORKING_WEEK_INCOMPLETE,
            message: 'Branch working-week overrides require a reason',
          });
        }
      }
    }

    if (
      scope === BusinessCalendarScope.COMPANY &&
      rules.length > 0 &&
      rules.length < 7
    ) {
      // Incomplete is allowed while drafting; submit-review enforces completeness.
    }
  }

  buildValidationSummary(version: {
    calendar: { scope: BusinessCalendarScope };
    workingWeekRules: Array<{
      dayOfWeek: number;
      ruleMode: BusinessCalendarRuleMode;
      reason: string | null;
    }>;
    events: Array<{ id: string }>;
  }) {
    const issues: string[] = [];
    const scope = version.calendar.scope;
    const days = new Set(
      version.workingWeekRules.map((rule) => rule.dayOfWeek),
    );

    if (scope === BusinessCalendarScope.COMPANY) {
      for (let day = 0; day <= 6; day += 1) {
        if (!days.has(day)) {
          issues.push(`Missing company working-week rule for day ${day}`);
        }
      }
      const nonDefine = version.workingWeekRules.filter(
        (rule) => rule.ruleMode !== BusinessCalendarRuleMode.DEFINE,
      );
      if (nonDefine.length > 0) {
        issues.push('Company working-week rules must all be DEFINE');
      }
    } else {
      const missingReason = version.workingWeekRules.filter(
        (rule) =>
          rule.ruleMode === BusinessCalendarRuleMode.OVERRIDE &&
          !rule.reason?.trim(),
      );
      if (missingReason.length > 0) {
        issues.push('Branch override rules require a reason');
      }
      const nonOverride = version.workingWeekRules.filter(
        (rule) => rule.ruleMode !== BusinessCalendarRuleMode.OVERRIDE,
      );
      if (nonOverride.length > 0) {
        issues.push('Branch working-week rules must all be OVERRIDE');
      }
    }

    return {
      issues,
      readyForReview: issues.length === 0,
      workingWeekRuleCount: version.workingWeekRules.length,
      eventCount: version.events.length,
      inheritanceNote:
        scope === BusinessCalendarScope.BRANCH
          ? 'Missing weekdays inherit from the parent Company calendar at runtime (Stage 4+).'
          : 'Company calendar defines the base working week for branches.',
    };
  }

  withValidationSummary<
    T extends {
      calendar: { scope: BusinessCalendarScope };
      workingWeekRules: Array<{
        dayOfWeek: number;
        ruleMode: BusinessCalendarRuleMode;
        reason: string | null;
      }>;
      events: Array<{ id: string }>;
    },
  >(version: T) {
    return {
      ...version,
      validation: this.buildValidationSummary(version),
    };
  }

  private parseDateOnly(value: string, field: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private async requireCalendar(calendarId: string) {
    const calendar = await this.prisma.businessCalendar.findFirst({
      where: {
        id: calendarId,
        company: this.employeeDomainScope.companyWhere(),
      },
    });
    if (!calendar) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Business calendar not found',
      });
    }
    await this.employeeDomainScope.assertCompanyInScope(calendar.companyId);
    return calendar;
  }

  async requireVersion(versionId: string) {
    const version = await this.prisma.businessCalendarVersion.findFirst({
      where: {
        id: versionId,
        calendar: { company: this.employeeDomainScope.companyWhere() },
      },
      include: this.versionSummaryInclude(),
    });
    if (!version) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_FOUND,
        message: 'Business calendar version not found',
      });
    }
    await this.employeeDomainScope.assertCompanyInScope(
      version.calendar.companyId,
    );
    return version;
  }

  versionSummaryInclude() {
    return {
      calendar: {
        select: {
          id: true,
          companyId: true,
          branchId: true,
          scope: true,
          calendarCode: true,
          calendarName: true,
          defaultTimezone: true,
          parentCalendarId: true,
        },
      },
      workingWeekRules: {
        orderBy: { dayOfWeek: 'asc' as const },
      },
      events: {
        select: { id: true },
      },
    } satisfies Prisma.BusinessCalendarVersionInclude;
  }
}
