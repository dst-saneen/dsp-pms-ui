import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import {
  addMonthsUtc,
  eachDateInclusive,
  resolveBusinessDay,
  type RuntimeEvent,
  type RuntimeWeekRule,
} from './business-calendar-runtime.util';
import {
  RuntimeDayQueryDto,
  RuntimePreviewDto,
  RuntimeRangeQueryDto,
  RuntimeRebuildDto,
} from './dto/business-calendar-publish.dto';

type VersionBundle = {
  id: string;
  calendarId: string;
  contentChecksum: string;
  status: BusinessCalendarVersionStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  workingWeekRules: RuntimeWeekRule[];
  events: RuntimeEvent[];
  calendar: {
    id: string;
    companyId: string;
    branchId: string | null;
    scope: BusinessCalendarScope;
    defaultTimezone: string;
    parentCalendarId: string | null;
    scopeKey: string;
  };
};

@Injectable()
export class BusinessCalendarRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async previewDay(dto: RuntimePreviewDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const businessDate = this.parseDate(dto.date);
    const context = await this.loadResolutionContext({
      companyId: dto.companyId,
      branchId: dto.branchId,
      businessDate,
      companyVersionId: dto.companyVersionId,
      branchVersionId: dto.branchVersionId,
      allowDraft: true,
    });
    return {
      preview: true,
      companyId: dto.companyId,
      branchId: dto.branchId ?? null,
      businessDate: dto.date,
      timezone: context.timezone,
      officeScopeKey: context.officeScopeKey,
      calendarId: context.calendarId,
      companyVersionId: context.companyVersion.id,
      branchVersionId: context.branchVersion?.id ?? null,
      result: context.resolved,
    };
  }

  /**
   * Resolve every business date in the range in memory after one version load.
   * Leave duration and range APIs must use this instead of looping previewDay.
   */
  async previewRange(
    dto: RuntimeRangeQueryDto,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const from = this.parseDate(dto.from);
    const to = this.parseDate(dto.to);
    this.assertBoundedRange(from, to, 400);

    const office = await this.resolveOfficeCalendar(
      dto.companyId,
      dto.branchId,
      db,
    );
    const companyCalendar = await this.requireCompanyCalendar(
      dto.companyId,
      db,
    );
    const companyVersions = await this.loadPublishedVersionBundles(
      companyCalendar.id,
      from,
      to,
      db,
    );

    let branchVersions: VersionBundle[] = [];
    if (dto.branchId) {
      const branchCalendar = await db.businessCalendar.findFirst({
        where: {
          companyId: dto.companyId,
          branchId: dto.branchId,
          scope: BusinessCalendarScope.BRANCH,
          isActive: true,
        },
      });
      if (branchCalendar) {
        branchVersions = await this.loadPublishedVersionBundles(
          branchCalendar.id,
          from,
          to,
          db,
        );
      }
    }

    return eachDateInclusive(from, to).map((businessDate) => {
      const companyVersion = this.pickEffectiveVersion(
        companyVersions,
        businessDate,
      );
      if (!companyVersion) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_FOUND,
          message: 'No effective company calendar version for this date',
        });
      }

      const branchVersion = this.pickEffectiveVersion(
        branchVersions,
        businessDate,
      );
      const { resolved } = this.resolveDayFromVersions({
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        businessDate,
        companyVersion,
        branchVersion,
      });

      return {
        preview: true as const,
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        businessDate: businessDate.toISOString().slice(0, 10),
        timezone: office.timezone,
        officeScopeKey: office.scopeKey,
        calendarId: office.id,
        companyVersionId: companyVersion.id,
        branchVersionId: branchVersion?.id ?? null,
        result: resolved,
      };
    });
  }

  async getDay(dto: RuntimeDayQueryDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const businessDate = this.parseDate(dto.date);
    const office = await this.resolveOfficeCalendar(
      dto.companyId,
      dto.branchId,
    );
    const row = await this.prisma.businessCalendarRuntimeDay.findFirst({
      where: {
        officeScopeKey: office.scopeKey,
        businessDate,
        isCurrent: true,
      },
    });
    if (row) {
      return { materialized: true, ...row };
    }

    const preview = await this.previewDay({
      companyId: dto.companyId,
      branchId: dto.branchId,
      date: dto.date,
    });
    return { materialized: false, ...preview };
  }

  async getRange(dto: RuntimeRangeQueryDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const from = this.parseDate(dto.from);
    const to = this.parseDate(dto.to);
    this.assertBoundedRange(from, to, 400);

    const office = await this.resolveOfficeCalendar(
      dto.companyId,
      dto.branchId,
    );
    const rows = await this.prisma.businessCalendarRuntimeDay.findMany({
      where: {
        officeScopeKey: office.scopeKey,
        businessDate: { gte: from, lte: to },
        isCurrent: true,
      },
      orderBy: { businessDate: 'asc' },
    });

    const byDate = new Map(
      rows.map((row) => [row.businessDate.toISOString().slice(0, 10), row]),
    );

    const missingKeys: string[] = [];
    for (const date of eachDateInclusive(from, to)) {
      const key = date.toISOString().slice(0, 10);
      if (!byDate.has(key)) {
        missingKeys.push(key);
      }
    }

    const previewByDate = new Map<
      string,
      Awaited<
        ReturnType<BusinessCalendarRuntimeService['previewRange']>
      >[number]
    >();
    if (missingKeys.length > 0) {
      const previews = await this.previewRange({
        companyId: dto.companyId,
        branchId: dto.branchId,
        from: missingKeys[0],
        to: missingKeys[missingKeys.length - 1],
      });
      for (const preview of previews) {
        previewByDate.set(preview.businessDate, preview);
      }
    }

    const days: Array<Record<string, unknown>> = [];
    let materializedCount = 0;
    let previewCount = 0;

    for (const date of eachDateInclusive(from, to)) {
      const key = date.toISOString().slice(0, 10);
      const row = byDate.get(key);
      if (row) {
        materializedCount += 1;
        days.push({
          materialized: true,
          businessDate: key,
          dayStatus: row.dayStatus,
          dayPortion: row.dayPortion,
          reasonCode: row.reasonCode,
          reasonText: row.reasonText,
          resolutionTrace: row.resolutionTrace,
        });
        continue;
      }

      previewCount += 1;
      const result = previewByDate.get(key)?.result;
      days.push({
        materialized: false,
        businessDate: key,
        dayStatus: result?.dayStatus,
        dayPortion: result?.dayPortion,
        reasonCode: result?.reasonCode,
        reasonText: result?.reasonText,
        resolutionTrace: result?.resolutionTrace,
      });
    }

    return {
      from: dto.from,
      to: dto.to,
      materializedCount,
      previewCount,
      days,
    };
  }

  async rebuild(dto: RuntimeRebuildDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const from = this.parseDate(dto.from);
    const to = this.parseDate(dto.to);
    this.assertBoundedRange(from, to, 400);

    const office = await this.resolveOfficeCalendar(
      dto.companyId,
      dto.branchId,
    );
    const materialize = await this.materializeRange({
      companyId: dto.companyId,
      branchId: dto.branchId ?? null,
      calendarId: office.id,
      officeScopeKey: office.scopeKey,
      timezone: office.timezone,
      from,
      to,
    });

    return materialize;
  }

  async materializeRange(input: {
    companyId: string;
    branchId: string | null;
    calendarId: string;
    officeScopeKey: string;
    timezone: string;
    from: Date;
    to: Date;
    tx?: Prisma.TransactionClient;
  }) {
    const db = input.tx ?? this.prisma;
    let written = 0;
    let skipped = 0;

    const companyCalendar = await this.requireCompanyCalendar(
      input.companyId,
      db,
    );
    const companyVersions = await this.loadPublishedVersionBundles(
      companyCalendar.id,
      input.from,
      input.to,
      db,
    );

    let branchVersions: VersionBundle[] = [];
    if (input.branchId) {
      const branchCalendar = await db.businessCalendar.findFirst({
        where: {
          companyId: input.companyId,
          branchId: input.branchId,
          scope: BusinessCalendarScope.BRANCH,
          isActive: true,
        },
      });
      if (branchCalendar) {
        branchVersions = await this.loadPublishedVersionBundles(
          branchCalendar.id,
          input.from,
          input.to,
          db,
        );
      }
    }

    const existingRows = await db.businessCalendarRuntimeDay.findMany({
      where: {
        officeScopeKey: input.officeScopeKey,
        businessDate: { gte: input.from, lte: input.to },
        isCurrent: true,
      },
    });
    const existingByDate = new Map(
      existingRows.map((row) => [
        row.businessDate.toISOString().slice(0, 10),
        row,
      ]),
    );

    const supersedeIds: string[] = [];
    const createRows: Prisma.BusinessCalendarRuntimeDayCreateManyInput[] = [];
    const resolvedAt = new Date();

    for (const businessDate of eachDateInclusive(input.from, input.to)) {
      const companyVersion = this.pickEffectiveVersion(
        companyVersions,
        businessDate,
      );
      if (!companyVersion) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_FOUND,
          message: 'No effective company calendar version for this date',
        });
      }
      if (companyVersion.status !== BusinessCalendarVersionStatus.PUBLISHED) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
          message:
            'Runtime materialization requires a published company version',
        });
      }

      const branchVersion = this.pickEffectiveVersion(
        branchVersions,
        businessDate,
      );
      const { resolved } = this.resolveDayFromVersions({
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        businessDate,
        companyVersion,
        branchVersion,
      });

      const dateKey = businessDate.toISOString().slice(0, 10);
      const existing = existingByDate.get(dateKey);

      if (
        existing &&
        existing.sourceChecksum === resolved.sourceChecksum &&
        existing.companyVersionId === companyVersion.id &&
        existing.branchVersionId === (branchVersion?.id ?? null)
      ) {
        skipped += 1;
        continue;
      }

      const nextRevision = existing ? existing.runtimeRevision + 1 : 1;
      if (existing) {
        supersedeIds.push(existing.id);
      }

      createRows.push({
        officeScopeKey: input.officeScopeKey,
        companyId: input.companyId,
        branchId: input.branchId,
        calendarId: input.calendarId,
        businessDate,
        runtimeRevision: nextRevision,
        isCurrent: true,
        companyVersionId: companyVersion.id,
        branchVersionId: branchVersion?.id ?? null,
        timezone: input.timezone,
        dayStatus: resolved.dayStatus,
        dayPortion: resolved.dayPortion,
        reasonCode: resolved.reasonCode,
        reasonText: resolved.reasonText,
        controllingEventId: resolved.controllingEventId,
        resolutionTrace: resolved.resolutionTrace,
        sourceChecksum: resolved.sourceChecksum,
        resolvedAt,
      });
      written += 1;
    }

    if (supersedeIds.length > 0) {
      for (const chunk of chunkIds(supersedeIds, 200)) {
        await db.businessCalendarRuntimeDay.updateMany({
          where: { id: { in: chunk } },
          data: { isCurrent: false, supersededAt: resolvedAt },
        });
      }
    }

    for (const chunk of chunkRows(createRows, 100)) {
      await db.businessCalendarRuntimeDay.createMany({ data: chunk });
    }

    return { from: input.from, to: input.to, written, skipped };
  }

  defaultMaterializeTo(effectiveFrom: Date, effectiveTo: Date | null): Date {
    if (effectiveTo) return effectiveTo;
    return addMonthsUtc(effectiveFrom, 18);
  }

  private async loadResolutionContext(input: {
    companyId: string;
    branchId?: string;
    businessDate: Date;
    companyVersionId?: string;
    branchVersionId?: string;
    allowDraft: boolean;
    db?: Prisma.TransactionClient | PrismaService;
  }) {
    const db = input.db ?? this.prisma;
    const office = await this.resolveOfficeCalendar(
      input.companyId,
      input.branchId,
      db,
    );

    const companyCalendar = await this.requireCompanyCalendar(
      input.companyId,
      db,
    );

    const companyVersion = input.companyVersionId
      ? await this.loadVersionBundle(input.companyVersionId, db)
      : await this.findEffectivePublishedVersion(
          companyCalendar.id,
          input.businessDate,
          db,
        );

    if (!companyVersion) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_FOUND,
        message: 'No effective company calendar version for this date',
      });
    }
    if (
      !input.allowDraft &&
      companyVersion.status !== BusinessCalendarVersionStatus.PUBLISHED
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Runtime materialization requires a published company version',
      });
    }

    let branchVersion: VersionBundle | null = null;
    if (input.branchId) {
      const branchCalendar = await db.businessCalendar.findFirst({
        where: {
          companyId: input.companyId,
          branchId: input.branchId,
          scope: BusinessCalendarScope.BRANCH,
          isActive: true,
        },
      });
      if (branchCalendar) {
        branchVersion = input.branchVersionId
          ? await this.loadVersionBundle(input.branchVersionId, db)
          : await this.findEffectivePublishedVersion(
              branchCalendar.id,
              input.businessDate,
              db,
            );
      }
    }

    const { resolved } = this.resolveDayFromVersions({
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      businessDate: input.businessDate,
      companyVersion,
      branchVersion,
    });

    return {
      officeScopeKey: office.scopeKey,
      calendarId: office.id,
      timezone: office.timezone,
      companyVersion,
      branchVersion,
      resolved,
    };
  }

  private resolveDayFromVersions(input: {
    companyId: string;
    branchId: string | null;
    businessDate: Date;
    companyVersion: VersionBundle;
    branchVersion: VersionBundle | null;
  }) {
    const sourceChecksum = createHash('sha256')
      .update(
        [
          input.companyVersion.contentChecksum,
          input.branchVersion?.contentChecksum ?? '',
          input.businessDate.toISOString().slice(0, 10),
        ].join('|'),
      )
      .digest('hex');

    return {
      sourceChecksum,
      resolved: resolveBusinessDay({
        companyId: input.companyId,
        branchId: input.branchId,
        businessDate: input.businessDate,
        companyWeekRules: input.companyVersion.workingWeekRules,
        companyEvents: input.companyVersion.events,
        branchWeekRules: input.branchVersion?.workingWeekRules,
        branchEvents: input.branchVersion?.events,
        sourceChecksum,
      }),
    };
  }

  private async resolveOfficeCalendar(
    companyId: string,
    branchId?: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (branchId) {
      const branch = await db.branch.findFirst({
        where: {
          id: branchId,
          companyId,
          ...this.employeeDomainScope.branchWhere(),
        },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      const calendar = await db.businessCalendar.findFirst({
        where: {
          companyId,
          branchId,
          scope: BusinessCalendarScope.BRANCH,
          isActive: true,
        },
      });
      if (calendar) {
        return {
          id: calendar.id,
          scopeKey: calendar.scopeKey,
          timezone: branch.timezone || calendar.defaultTimezone,
        };
      }
      const companyCalendar = await this.requireCompanyCalendar(companyId, db);
      return {
        id: companyCalendar.id,
        scopeKey: companyCalendar.scopeKey,
        timezone: branch.timezone || companyCalendar.defaultTimezone,
      };
    }

    const companyCalendar = await this.requireCompanyCalendar(companyId, db);
    return {
      id: companyCalendar.id,
      scopeKey: companyCalendar.scopeKey,
      timezone: companyCalendar.defaultTimezone,
    };
  }

  private async requireCompanyCalendar(
    companyId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const calendar = await db.businessCalendar.findFirst({
      where: {
        companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
    });
    if (!calendar) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Company calendar not found',
      });
    }
    return calendar;
  }

  private async loadPublishedVersionBundles(
    calendarId: string,
    from: Date,
    to: Date,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<VersionBundle[]> {
    const versions = await db.businessCalendarVersion.findMany({
      where: {
        calendarId,
        status: BusinessCalendarVersionStatus.PUBLISHED,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      orderBy: { versionNumber: 'desc' },
      include: this.versionBundleInclude(),
    });
    return versions.map((version) => this.mapVersionBundle(version));
  }

  private pickEffectiveVersion(
    versions: VersionBundle[],
    businessDate: Date,
  ): VersionBundle | null {
    const time = businessDate.getTime();
    for (const version of versions) {
      if (version.effectiveFrom.getTime() > time) continue;
      if (version.effectiveTo && version.effectiveTo.getTime() < time) continue;
      return version;
    }
    return null;
  }

  private async findEffectivePublishedVersion(
    calendarId: string,
    businessDate: Date,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<VersionBundle | null> {
    const version = await db.businessCalendarVersion.findFirst({
      where: {
        calendarId,
        status: BusinessCalendarVersionStatus.PUBLISHED,
        effectiveFrom: { lte: businessDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: businessDate } }],
      },
      orderBy: { versionNumber: 'desc' },
      include: this.versionBundleInclude(),
    });
    return version ? this.mapVersionBundle(version) : null;
  }

  private async loadVersionBundle(
    versionId: string,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<VersionBundle> {
    const version = await db.businessCalendarVersion.findFirst({
      where: { id: versionId },
      include: this.versionBundleInclude(),
    });
    if (!version) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_FOUND,
        message: 'Calendar version not found',
      });
    }
    return this.mapVersionBundle(version);
  }

  private mapVersionBundle(
    version: Prisma.BusinessCalendarVersionGetPayload<{
      include: ReturnType<
        BusinessCalendarRuntimeService['versionBundleInclude']
      >;
    }>,
  ): VersionBundle {
    return {
      id: version.id,
      calendarId: version.calendarId,
      contentChecksum: version.contentChecksum,
      status: version.status,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      workingWeekRules: version.workingWeekRules.map((rule) => ({
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
        targets: event.targets.map((target) => ({
          targetType: target.targetType,
          companyId: target.companyId,
          branchId: target.branchId,
        })),
      })),
      calendar: {
        id: version.calendar.id,
        companyId: version.calendar.companyId,
        branchId: version.calendar.branchId,
        scope: version.calendar.scope,
        defaultTimezone: version.calendar.defaultTimezone,
        parentCalendarId: version.calendar.parentCalendarId,
        scopeKey: version.calendar.scopeKey,
      },
    };
  }

  private versionBundleInclude() {
    return {
      calendar: true,
      workingWeekRules: true,
      events: { include: { targets: true } },
    } satisfies Prisma.BusinessCalendarVersionInclude;
  }

  private parseDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private assertBoundedRange(from: Date, to: Date, maxDays: number) {
    if (to < from) {
      throw new BadRequestException('to cannot precede from');
    }
    const days = eachDateInclusive(from, to).length;
    if (days > maxDays) {
      throw new BadRequestException(
        `Date range too large (${days} days). Max ${maxDays}.`,
      );
    }
  }
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
