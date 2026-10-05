import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
  Prisma,
} from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants/workforce-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayFilterDto } from './dto/holiday-filter.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

export type HolidaySource = 'LEGACY_HOLIDAYS' | 'BUSINESS_CALENDAR';

export type HolidayOfficeSource = {
  companyId: string;
  companyName: string;
  branchId: string | null;
  branchName: string | null;
  calendarId: string | null;
  runtimeMode: BusinessCalendarRuntimeMode;
  source: HolidaySource;
};

type CalendarLookup = {
  id: string;
  companyId: string;
  branchId: string | null;
  scope: BusinessCalendarScope;
  runtimeMode: BusinessCalendarRuntimeMode;
};

@Injectable()
export class HolidayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateHolidayDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);

    const company = await this.prisma.company.findFirst({
      where: {
        id: dto.companyId,
        ...this.employeeDomainScope.companyWhere(),
      },
    });

    if (!company) {
      throw new BadRequestException('Company not found');
    }
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          companyId: dto.companyId,
        },
      });

      if (!branch) {
        throw new BadRequestException('Branch not found');
      }
    }
    const existingHoliday = await this.prisma.holiday.findFirst({
      where: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        holidayName: dto.holidayName,
        holidayDate: new Date(dto.holidayDate),
        isActive: true,
      },
    });
    if (dto.holidayCode) {
      const codeExists = await this.prisma.holiday.findFirst({
        where: {
          companyId: dto.companyId,
          holidayCode: dto.holidayCode,
          isActive: true,
        },
      });

      if (codeExists) {
        throw new BadRequestException('Holiday code already exists');
      }
    }

    if (existingHoliday) {
      throw new BadRequestException('Holiday already exists');
    }

    await this.assertLegacyHolidayMaster(dto.companyId, dto.branchId);

    return this.prisma.holiday.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId,
        holidayCode: dto.holidayCode,
        holidayName: dto.holidayName,
        description: dto.description,
        holidayDate: new Date(dto.holidayDate),
        holidayType: dto.holidayType,
      },
    });
  }

  async findAll(filters: HolidayFilterDto) {
    const where: Prisma.HolidayWhereInput = {
      isActive: true,
      ...this.employeeDomainScope.holidayWhere(),
    };

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.holidayType) {
      where.holidayType = filters.holidayType;
    }

    if (filters.year) {
      where.holidayDate = {
        gte: new Date(`${filters.year}-01-01`),
        lt: new Date(`${filters.year + 1}-01-01`),
      };
    }

    const rows = await this.prisma.holiday.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            companyCode: true,
            companyName: true,
          },
        },
        branch: {
          select: {
            id: true,
            branchCode: true,
            branchName: true,
          },
        },
      },
      orderBy: {
        holidayDate: 'asc',
      },
    });
    const calendars = await this.loadCalendars([
      ...new Set(rows.map((row) => row.companyId)),
    ]);
    return rows.map((row) => ({
      ...row,
      ...this.describeSource(row.companyId, row.branchId, calendars),
    }));
  }

  /**
   * HR Leave → Holidays directory: published Business Calendar HOLIDAY events
   * (primary), plus any remaining old-list rows for LEGACY offices.
   */
  async listDirectory(filters: HolidayFilterDto) {
    const companies = await this.prisma.company.findMany({
      where: {
        ...this.employeeDomainScope.companyWhere(),
        ...(filters.companyId ? { id: filters.companyId } : {}),
      },
      select: { id: true, companyName: true, companyCode: true },
      orderBy: { companyName: 'asc' },
    });
    let companyIds = companies.map((row) => row.id);
    if (companyIds.length === 0) {
      return [];
    }

    if (filters.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: filters.branchId,
          isActive: true,
          ...this.employeeDomainScope.branchWhere(),
        },
        select: { companyId: true },
      });
      if (
        !branch ||
        (filters.companyId && branch.companyId !== filters.companyId) ||
        !companyIds.includes(branch.companyId)
      ) {
        return [];
      }
      companyIds = [branch.companyId];
    }

    const matchingCalendars = await this.prisma.businessCalendar.findMany({
      where: {
        isActive: true,
        companyId: { in: companyIds },
        ...(filters.branchId
          ? {
              OR: [
                { branchId: filters.branchId },
                { scope: BusinessCalendarScope.COMPANY },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        scope: true,
        runtimeMode: true,
        calendarName: true,
        company: {
          select: { id: true, companyCode: true, companyName: true },
        },
        branch: {
          select: { id: true, branchCode: true, branchName: true },
        },
      },
    });
    const calendars = filters.branchId
      ? (() => {
          const branchCalendar = matchingCalendars.find(
            (calendar) =>
              calendar.scope === BusinessCalendarScope.BRANCH &&
              calendar.branchId === filters.branchId,
          );
          const companyCalendar = matchingCalendars.find(
            (calendar) => calendar.scope === BusinessCalendarScope.COMPANY,
          );
          return branchCalendar
            ? [branchCalendar]
            : companyCalendar
              ? [companyCalendar]
              : [];
        })()
      : matchingCalendars.filter(
          (calendar) =>
            calendar.runtimeMode !== BusinessCalendarRuntimeMode.LEGACY,
        );

    const calendarIds = calendars.map((row) => row.id);
    const publishedVersions =
      calendarIds.length === 0
        ? []
        : await this.prisma.businessCalendarVersion.findMany({
            where: {
              calendarId: { in: calendarIds },
              status: 'PUBLISHED',
            },
            orderBy: [{ publishedAt: 'desc' }, { versionNumber: 'desc' }],
            select: {
              id: true,
              calendarId: true,
              versionNumber: true,
              effectiveFrom: true,
              effectiveTo: true,
              publishedAt: true,
            },
          });

    const publishedVersionIdByCalendar = new Map<string, string>();
    for (const version of publishedVersions) {
      if (!publishedVersionIdByCalendar.has(version.calendarId)) {
        publishedVersionIdByCalendar.set(version.calendarId, version.id);
      }
    }
    const publishedVersionIds = [...publishedVersionIdByCalendar.values()];

    const yearFilter =
      filters.year != null
        ? {
            gte: new Date(`${filters.year}-01-01`),
            lt: new Date(`${filters.year + 1}-01-01`),
          }
        : undefined;

    const calendarEvents =
      publishedVersionIds.length === 0
        ? []
        : await this.prisma.businessCalendarEvent.findMany({
            where: {
              calendarVersionId: { in: publishedVersionIds },
              eventType: { eventTypeCode: 'HOLIDAY' },
              ...(yearFilter ? { startDate: yearFilter } : {}),
            },
            include: {
              eventType: {
                select: { eventTypeCode: true, eventTypeName: true },
              },
              calendarVersion: {
                select: {
                  id: true,
                  versionNumber: true,
                  effectiveFrom: true,
                  effectiveTo: true,
                  publishedAt: true,
                  calendar: {
                    select: {
                      id: true,
                      companyId: true,
                      branchId: true,
                      scope: true,
                      runtimeMode: true,
                      calendarName: true,
                      company: {
                        select: {
                          id: true,
                          companyCode: true,
                          companyName: true,
                        },
                      },
                      branch: {
                        select: {
                          id: true,
                          branchCode: true,
                          branchName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { startDate: 'asc' },
          });

    const fromCalendar = calendarEvents.map((event) => {
      const calendar = event.calendarVersion.calendar;
      return {
        id: event.id,
        companyId: calendar.companyId,
        branchId: calendar.branchId,
        holidayCode: event.eventCode,
        holidayName: event.eventName,
        holidayDate: event.startDate,
        endDate: event.endDate,
        holidayType: event.eventType.eventTypeName || 'Holiday',
        dayPortion: null as string | null,
        description: event.description,
        paidHoliday: event.paidHoliday,
        isOptionalHoliday: event.isOptionalHoliday,
        company: calendar.company,
        branch: calendar.branch,
        calendarId: calendar.id,
        calendarName: calendar.calendarName,
        calendarScope: calendar.scope,
        runtimeMode: calendar.runtimeMode,
        source: 'BUSINESS_CALENDAR',
        versionNumber: event.calendarVersion.versionNumber,
        effectiveFrom: event.calendarVersion.effectiveFrom,
        effectiveTo: event.calendarVersion.effectiveTo,
        publishedAt: event.calendarVersion.publishedAt,
        isTransitioning:
          calendar.runtimeMode !== BusinessCalendarRuntimeMode.ACTIVE,
      };
    });

    const legacyRows = await this.findAll(filters);
    const fromLegacy = legacyRows
      .filter((row) => row.source === 'LEGACY_HOLIDAYS')
      .map((row) => ({
        ...row,
        endDate: row.holidayDate,
        calendarName: null as string | null,
        paidHoliday: null as boolean | null,
        isOptionalHoliday: null as boolean | null,
        versionNumber: null as number | null,
        calendarScope: null as BusinessCalendarScope | null,
        effectiveFrom: null as Date | null,
        effectiveTo: null as Date | null,
        publishedAt: null as Date | null,
        isTransitioning: row.runtimeMode !== BusinessCalendarRuntimeMode.ACTIVE,
      }));

    return [...fromCalendar, ...fromLegacy].sort((a, b) => {
      const left = new Date(a.holidayDate).getTime();
      const right = new Date(b.holidayDate).getTime();
      return left - right || a.holidayName.localeCompare(b.holidayName);
    });
  }

  async listSources(): Promise<{
    offices: HolidayOfficeSource[];
    canEditLegacyHolidays: boolean;
  }> {
    const companies = await this.prisma.company.findMany({
      where: this.employeeDomainScope.companyWhere(),
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    const companyIds = companies.map((row) => row.id);
    const branches = companyIds.length
      ? await this.prisma.branch.findMany({
          where: {
            ...this.employeeDomainScope.branchWhere(),
            companyId: { in: companyIds },
            isActive: true,
          },
          select: { id: true, companyId: true, branchName: true },
          orderBy: { branchName: 'asc' },
        })
      : [];
    const calendars = await this.loadCalendars(companyIds);
    const companyById = new Map(companies.map((row) => [row.id, row]));

    const offices: HolidayOfficeSource[] = companies.map((company) => {
      const described = this.describeSource(company.id, null, calendars);
      return {
        companyId: company.id,
        companyName: company.companyName,
        branchId: null,
        branchName: null,
        ...described,
      };
    });

    for (const branch of branches) {
      const company = companyById.get(branch.companyId);
      if (!company) continue;
      const described = this.describeSource(
        branch.companyId,
        branch.id,
        calendars,
      );
      offices.push({
        companyId: branch.companyId,
        companyName: company.companyName,
        branchId: branch.id,
        branchName: branch.branchName,
        ...described,
      });
    }

    return {
      offices,
      canEditLegacyHolidays: offices.some(
        (office) => office.runtimeMode === BusinessCalendarRuntimeMode.LEGACY,
      ),
    };
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.holidayWhere(),
      },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    return holiday;
  }

  async update(id: string, dto: UpdateHolidayDto) {
    const holiday = await this.findOne(id);
    await this.assertLegacyHolidayMaster(holiday.companyId, holiday.branchId);
    if (dto.companyId || dto.branchId !== undefined) {
      await this.assertLegacyHolidayMaster(
        dto.companyId ?? holiday.companyId,
        dto.branchId === undefined ? holiday.branchId : dto.branchId,
      );
    }

    return this.prisma.holiday.update({
      where: { id },
      data: {
        ...dto,
        holidayDate: dto.holidayDate ? new Date(dto.holidayDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    const holiday = await this.findOne(id);
    await this.assertLegacyHolidayMaster(holiday.companyId, holiday.branchId);

    return this.prisma.holiday.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  private async assertLegacyHolidayMaster(
    companyId: string,
    branchId?: string | null,
  ) {
    const { runtimeMode } = this.describeSource(
      companyId,
      branchId ?? null,
      await this.loadCalendars([companyId]),
    );
    if (runtimeMode !== BusinessCalendarRuntimeMode.LEGACY) {
      throw new ConflictException({
        code: WorkforceErrorCode.HOLIDAY_MASTER_MOVED,
        message:
          'This office uses Business Calendar for holidays. Edit holidays there instead of Leave → Holidays.',
      });
    }
  }

  private async loadCalendars(companyIds: string[]): Promise<CalendarLookup[]> {
    if (companyIds.length === 0) return [];
    return this.prisma.businessCalendar.findMany({
      where: {
        isActive: true,
        companyId: { in: companyIds },
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        scope: true,
        runtimeMode: true,
      },
    });
  }

  private describeSource(
    companyId: string,
    branchId: string | null,
    calendars: CalendarLookup[],
  ): {
    calendarId: string | null;
    runtimeMode: BusinessCalendarRuntimeMode;
    source: HolidaySource;
  } {
    const branchCalendar = branchId
      ? calendars.find(
          (row) =>
            row.scope === BusinessCalendarScope.BRANCH &&
            row.branchId === branchId,
        )
      : undefined;
    const companyCalendar = calendars.find(
      (row) =>
        row.scope === BusinessCalendarScope.COMPANY &&
        row.companyId === companyId,
    );
    const office = branchCalendar ?? companyCalendar;
    const runtimeMode =
      office?.runtimeMode ?? BusinessCalendarRuntimeMode.LEGACY;
    return {
      calendarId: office?.id ?? null,
      runtimeMode,
      source:
        runtimeMode === BusinessCalendarRuntimeMode.LEGACY
          ? 'LEGACY_HOLIDAYS'
          : 'BUSINESS_CALENDAR',
    };
  }
}
