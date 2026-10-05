import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { buildBusinessCalendarScopeKey } from './business-calendar-scope.util';
import {
  isOfficeLocationReady,
  isValidIanaTimeZone,
} from './business-calendar-validators';
import {
  EnsureOfficeCalendarsDto,
  ProvisionBranchCalendarDto,
  ProvisionCompanyCalendarDto,
  UpdateBusinessCalendarDto,
} from './dto/business-calendar-admin.dto';

export type CalendarConfigurationStatus =
  | 'READY'
  | 'MISSING_TIMEZONE'
  | 'MISSING_LOCATION'
  | 'LEGACY_MODE'
  | 'SHADOW_MODE'
  | 'ACTIVE_MODE'
  | 'INACTIVE';

@Injectable()
export class BusinessCalendarAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async list(filters: { companyId?: string; branchId?: string }) {
    const where: Prisma.BusinessCalendarWhereInput = {
      company: this.employeeDomainScope.companyWhere(),
    };
    if (filters.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(filters.companyId);
      where.companyId = filters.companyId;
    }
    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    const rows = await this.prisma.businessCalendar.findMany({
      where,
      include: this.calendarInclude(),
      orderBy: [
        { companyId: 'asc' },
        { scope: 'asc' },
        { calendarName: 'asc' },
      ],
    });

    return rows.map((row) => this.withStatus(row));
  }

  async getOne(id: string) {
    const row = await this.prisma.businessCalendar.findFirst({
      where: {
        id,
        company: this.employeeDomainScope.companyWhere(),
      },
      include: this.calendarInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Business calendar not found',
      });
    }
    return this.withStatus(row);
  }

  async provisionCompanyCalendar(
    dto: ProvisionCompanyCalendarDto,
    actorUserId: string,
  ) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const timezoneValue = dto.defaultTimezone?.trim();
    if (!timezoneValue || !isValidIanaTimeZone(timezoneValue)) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
        message: 'defaultTimezone must be a valid IANA timezone',
      });
    }
    const timezone = timezoneValue;
    const code = dto.calendarCode.trim().toUpperCase();
    const scopeKey = buildBusinessCalendarScopeKey(
      BusinessCalendarScope.COMPANY,
      dto.companyId,
    );

    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, ...this.employeeDomainScope.companyWhere() },
    });
    if (!company) {
      throw new BadRequestException('Company not found');
    }

    const existing = await this.prisma.businessCalendar.findFirst({
      where: {
        OR: [{ scopeKey }, { companyId: dto.companyId, scope: 'COMPANY' }],
      },
      include: this.calendarInclude(),
    });
    if (existing) {
      return { created: false, calendar: this.withStatus(existing) };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const calendar = await tx.businessCalendar.create({
        data: {
          companyId: dto.companyId,
          branchId: null,
          parentCalendarId: null,
          scope: BusinessCalendarScope.COMPANY,
          scopeKey,
          calendarCode: code,
          calendarName: dto.calendarName.trim(),
          defaultTimezone: timezone,
          runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
          isActive: true,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });

      await this.auditService.log(
        'BusinessCalendar',
        calendar.id,
        'CREATE',
        undefined,
        {
          scope: calendar.scope,
          scopeKey: calendar.scopeKey,
          companyId: calendar.companyId,
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendar',
        aggregateId: calendar.id,
        eventType: 'business_calendar.provisioned',
        dedupeKey: `business_calendar.provisioned:${calendar.scopeKey}`,
        companyId: calendar.companyId,
        payload: {
          companyId: calendar.companyId,
          status: calendar.runtimeMode,
        },
      });

      return tx.businessCalendar.findUniqueOrThrow({
        where: { id: calendar.id },
        include: this.calendarInclude(),
      });
    });

    return { created: true, calendar: this.withStatus(created) };
  }

  async provisionBranchCalendar(
    dto: ProvisionBranchCalendarDto,
    actorUserId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        isActive: true,
        ...this.employeeDomainScope.branchWhere(),
      },
      include: {
        company: true,
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.employeeDomainScope.assertCompanyInScope(branch.companyId);

    if (!branch.timezone || !isValidIanaTimeZone(branch.timezone)) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
        message:
          'Branch timezone must be a valid IANA timezone before creating a branch calendar',
      });
    }

    const parent = await this.prisma.businessCalendar.findFirst({
      where: {
        companyId: branch.companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
    });
    if (!parent) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_PARENT_INVALID,
        message:
          'Create the Company Calendar first before provisioning a Branch Calendar',
      });
    }
    if (parent.companyId !== branch.companyId) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_PARENT_INVALID,
        message: 'Parent calendar must belong to the same company',
      });
    }

    const scopeKey = buildBusinessCalendarScopeKey(
      BusinessCalendarScope.BRANCH,
      branch.id,
    );
    const existing = await this.prisma.businessCalendar.findFirst({
      where: { OR: [{ scopeKey }, { branchId: branch.id, scope: 'BRANCH' }] },
      include: this.calendarInclude(),
    });
    if (existing) {
      return { created: false, calendar: this.withStatus(existing) };
    }

    const code =
      dto.calendarCode?.trim().toUpperCase() ??
      `BR_${branch.branchCode.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`.slice(
        0,
        40,
      );
    const name = dto.calendarName?.trim() || `${branch.branchName} Calendar`;

    const created = await this.prisma.$transaction(async (tx) => {
      const calendar = await tx.businessCalendar.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          parentCalendarId: parent.id,
          scope: BusinessCalendarScope.BRANCH,
          scopeKey,
          calendarCode: code,
          calendarName: name,
          defaultTimezone: branch.timezone!,
          runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
          isActive: true,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });

      await this.auditService.log(
        'BusinessCalendar',
        calendar.id,
        'CREATE',
        undefined,
        {
          scope: calendar.scope,
          scopeKey: calendar.scopeKey,
          companyId: calendar.companyId,
          branchId: calendar.branchId,
          parentCalendarId: calendar.parentCalendarId,
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendar',
        aggregateId: calendar.id,
        eventType: 'business_calendar.provisioned',
        dedupeKey: `business_calendar.provisioned:${calendar.scopeKey}`,
        companyId: calendar.companyId,
        branchId: calendar.branchId,
        payload: {
          companyId: calendar.companyId,
          branchId: calendar.branchId,
          status: calendar.runtimeMode,
        },
      });

      return tx.businessCalendar.findUniqueOrThrow({
        where: { id: calendar.id },
        include: this.calendarInclude(),
      });
    });

    return { created: true, calendar: this.withStatus(created) };
  }

  async update(
    id: string,
    dto: UpdateBusinessCalendarDto,
    actorUserId: string,
  ) {
    const current = await this.getOne(id);
    if (dto.defaultTimezone) {
      if (!isValidIanaTimeZone(dto.defaultTimezone)) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
          message: 'defaultTimezone must be a valid IANA timezone',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const calendar = await tx.businessCalendar.update({
        where: { id },
        data: {
          calendarName: dto.calendarName?.trim(),
          defaultTimezone: dto.defaultTimezone?.trim(),
          isActive: dto.isActive,
          updatedByUserId: actorUserId,
        },
        include: this.calendarInclude(),
      });

      await this.auditService.log(
        'BusinessCalendar',
        calendar.id,
        'UPDATE',
        {
          calendarName: current.calendarName,
          defaultTimezone: current.defaultTimezone,
          isActive: current.isActive,
        },
        {
          calendarName: calendar.calendarName,
          defaultTimezone: calendar.defaultTimezone,
          isActive: calendar.isActive,
        },
        { userId: actorUserId, tx },
      );

      return calendar;
    });

    return this.withStatus(updated);
  }

  async ensureOfficeCalendars(
    dto: EnsureOfficeCalendarsDto,
    actorUserId: string,
  ) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    const dryRun = dto.dryRun !== false;

    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, ...this.employeeDomainScope.companyWhere() },
      include: {
        branches: { where: { isActive: true }, orderBy: { branchCode: 'asc' } },
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const plan: Array<{
      action: 'CREATE_COMPANY_CALENDAR' | 'CREATE_BRANCH_CALENDAR' | 'SKIP';
      office: string;
      reason?: string;
    }> = [];

    const companyCal = await this.prisma.businessCalendar.findFirst({
      where: { companyId: company.id, scope: 'COMPANY' },
    });
    const companyCalendarTimezone = companyCal
      ? undefined
      : this.resolveCompanyCalendarTimezone(
          dto.defaultTimezone,
          company.branches,
        );

    if (!companyCal) {
      plan.push({
        action: 'CREATE_COMPANY_CALENDAR',
        office: company.companyCode,
      });
    } else {
      plan.push({
        action: 'SKIP',
        office: company.companyCode,
        reason: 'Company calendar exists',
      });
    }

    for (const branch of company.branches) {
      const existing = await this.prisma.businessCalendar.findFirst({
        where: { branchId: branch.id, scope: 'BRANCH' },
      });
      if (existing) {
        plan.push({
          action: 'SKIP',
          office: branch.branchCode,
          reason: 'Branch calendar exists',
        });
        continue;
      }
      const branchTimezone = branch.timezone?.trim();
      if (!branchTimezone || !isValidIanaTimeZone(branchTimezone)) {
        plan.push({
          action: 'SKIP',
          office: branch.branchCode,
          reason: 'Missing or invalid branch timezone',
        });
        continue;
      }
      plan.push({
        action: 'CREATE_BRANCH_CALENDAR',
        office: branch.branchCode,
      });
    }

    if (dryRun) {
      return { dryRun: true, plan, created: [] as unknown[] };
    }

    const created: unknown[] = [];

    if (companyCalendarTimezone) {
      const result = await this.provisionCompanyCalendar(
        {
          companyId: company.id,
          calendarCode: 'MAIN',
          calendarName: `${company.companyName} Calendar`,
          defaultTimezone: companyCalendarTimezone,
        },
        actorUserId,
      );
      created.push(result.calendar);
    }

    for (const branch of company.branches) {
      const branchTimezone = branch.timezone?.trim();
      if (!branchTimezone || !isValidIanaTimeZone(branchTimezone)) continue;
      const result = await this.provisionBranchCalendar(
        { branchId: branch.id },
        actorUserId,
      );
      if (result.created) created.push(result.calendar);
    }

    return { dryRun: false, plan, created };
  }

  private resolveCompanyCalendarTimezone(
    requestedTimezone: string | undefined,
    branches: Array<{ timezone: string | null }>,
  ): string {
    const requested = requestedTimezone?.trim();
    if (
      requestedTimezone !== undefined &&
      (!requested || !isValidIanaTimeZone(requested))
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
        message: 'defaultTimezone must be a valid IANA timezone',
      });
    }

    if (requested) {
      return requested;
    }

    if (branches.length === 0) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
        message:
          'Provide defaultTimezone when no active Branch provides a timezone for the Company Calendar.',
      });
    }

    const invalidBranches = branches.filter(
      (branch) =>
        !branch.timezone?.trim() ||
        !isValidIanaTimeZone(branch.timezone.trim()),
    );
    if (invalidBranches.length === 0) {
      const configuredTimezones = [
        ...new Set(branches.map((branch) => branch.timezone!.trim())),
      ];
      if (configuredTimezones.length === 1) {
        return configuredTimezones[0];
      }
    }

    throw new BadRequestException({
      code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
      message:
        'Configure one valid, consistent active Branch timezone or provide defaultTimezone before creating a Company Calendar.',
    });
  }

  private withStatus<
    T extends {
      isActive: boolean;
      runtimeMode: BusinessCalendarRuntimeMode;
      defaultTimezone: string;
      scope: BusinessCalendarScope;
      versions?: Array<{ id: string }>;
      branch?: {
        timezone: string | null;
        countryCode: string | null;
        countrySubdivisionCode: string | null;
      } | null;
    },
  >(row: T) {
    const statuses: CalendarConfigurationStatus[] = [];
    if (!row.isActive) {
      statuses.push('INACTIVE');
    }
    if (row.runtimeMode === 'LEGACY') statuses.push('LEGACY_MODE');
    if (row.runtimeMode === 'SHADOW') statuses.push('SHADOW_MODE');
    if (row.runtimeMode === 'ACTIVE') statuses.push('ACTIVE_MODE');

    if (row.scope === 'BRANCH') {
      const tz = row.branch?.timezone ?? row.defaultTimezone;
      if (!tz || !isValidIanaTimeZone(tz)) {
        statuses.push('MISSING_TIMEZONE');
      }
      const location = isOfficeLocationReady({
        countryCode: row.branch?.countryCode,
        countrySubdivisionCode: row.branch?.countrySubdivisionCode,
        timezone: tz,
      });
      if (!location.ready && !statuses.includes('MISSING_TIMEZONE')) {
        statuses.push('MISSING_LOCATION');
      }
      if (location.ready && row.isActive) {
        statuses.push('READY');
      }
    } else if (
      row.isActive &&
      row.defaultTimezone &&
      isValidIanaTimeZone(row.defaultTimezone)
    ) {
      statuses.push('READY');
    } else if (!isValidIanaTimeZone(row.defaultTimezone)) {
      statuses.push('MISSING_TIMEZONE');
    }

    return {
      ...row,
      hasPublishedVersion: (row.versions?.length ?? 0) > 0,
      configurationStatus: [...new Set(statuses)],
    };
  }

  private calendarInclude() {
    return {
      company: {
        select: { id: true, companyCode: true, companyName: true },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          branchName: true,
          timezone: true,
          countryCode: true,
          countrySubdivisionCode: true,
          state: true,
        },
      },
      parentCalendar: {
        select: {
          id: true,
          calendarCode: true,
          calendarName: true,
          scope: true,
          scopeKey: true,
        },
      },
      childCalendars: {
        where: { isActive: true },
        select: {
          id: true,
          calendarCode: true,
          calendarName: true,
          branchId: true,
          scopeKey: true,
        },
      },
      versions: {
        where: { status: BusinessCalendarVersionStatus.PUBLISHED },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.BusinessCalendarInclude;
  }
}
