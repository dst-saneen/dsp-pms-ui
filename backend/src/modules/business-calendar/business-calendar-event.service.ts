import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarScope,
  BusinessDayEffect,
  CalendarEventTargetType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { isValidIanaTimeZone } from './business-calendar-validators';
import { BusinessCalendarVersionService } from './business-calendar-version.service';
import {
  CreateBusinessCalendarEventDto,
  EventTargetDto,
  ListEventsQueryDto,
  UpdateBusinessCalendarEventDto,
} from './dto/business-calendar-version.dto';

const EFFECT_TARGETS = new Set<CalendarEventTargetType>([
  CalendarEventTargetType.COMPANY,
  CalendarEventTargetType.BRANCH,
]);

const HALF_DAY_EFFECTS = new Set<BusinessDayEffect>([
  BusinessDayEffect.FIRST_HALF_NON_WORKING,
  BusinessDayEffect.SECOND_HALF_NON_WORKING,
]);

const NON_WORKING_EFFECTS = new Set<BusinessDayEffect>([
  BusinessDayEffect.NON_WORKING_DAY,
  BusinessDayEffect.FIRST_HALF_NON_WORKING,
  BusinessDayEffect.SECOND_HALF_NON_WORKING,
]);

@Injectable()
export class BusinessCalendarEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
    private readonly versions: BusinessCalendarVersionService,
  ) {}

  async listEvents(versionId: string, query: ListEventsQueryDto) {
    await this.versions.requireVersion(versionId);
    const where: Prisma.BusinessCalendarEventWhereInput = {
      calendarVersionId: versionId,
    };
    if (query.from || query.to) {
      where.AND = [];
      if (query.from) {
        where.AND.push({
          endDate: { gte: this.parseDateOnly(query.from) },
        });
      }
      if (query.to) {
        where.AND.push({
          startDate: { lte: this.parseDateOnly(query.to) },
        });
      }
    }

    return this.prisma.businessCalendarEvent.findMany({
      where,
      include: this.eventInclude(),
      orderBy: [{ startDate: 'asc' }, { eventName: 'asc' }],
    });
  }

  async getEvent(eventId: string) {
    const event = await this.prisma.businessCalendarEvent.findFirst({
      where: {
        id: eventId,
        company: this.employeeDomainScope.companyWhere(),
      },
      include: this.eventInclude(),
    });
    if (!event) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Business calendar event not found',
      });
    }
    await this.employeeDomainScope.assertCompanyInScope(event.companyId);
    return event;
  }

  async createEvent(
    versionId: string,
    dto: CreateBusinessCalendarEventDto,
    actorUserId: string,
  ) {
    const version = await this.versions.requireVersion(versionId);
    this.versions.assertDraftEditable(version);

    const normalized = await this.normalizeEventInput(version, dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const event = await tx.businessCalendarEvent.create({
        data: {
          calendarVersionId: version.id,
          companyId: version.calendar.companyId,
          eventTypeId: normalized.eventTypeId,
          eventCategoryId: normalized.eventCategoryId,
          eventSourceId: normalized.eventSourceId,
          eventCode: normalized.eventCode,
          eventName: normalized.eventName,
          description: normalized.description,
          allDay: normalized.allDay,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          startsAt: normalized.startsAt,
          endsAt: normalized.endsAt,
          eventTimezone: normalized.eventTimezone,
          businessDayEffect: normalized.businessDayEffect,
          paidHoliday: normalized.paidHoliday,
          isOptionalHoliday: normalized.isOptionalHoliday,
          isProtected: normalized.isProtected,
          createdByUserId: actorUserId,
          targets: {
            create: normalized.targets.map((target) => ({
              targetType: target.targetType,
              companyId: target.companyId,
              branchId: target.branchId ?? null,
              departmentId: target.departmentId ?? null,
              employeeId: target.employeeId ?? null,
              projectId: target.projectId ?? null,
            })),
          },
        },
        include: this.eventInclude(),
      });

      await tx.businessCalendarVersion.update({
        where: { id: version.id },
        data: { optimisticVersion: { increment: 1 } },
      });
      await this.versions.refreshChecksum(tx, version.id);

      await this.auditService.log(
        'BusinessCalendarEvent',
        event.id,
        'CREATE',
        undefined,
        {
          versionId: version.id,
          eventName: event.eventName,
          businessDayEffect: event.businessDayEffect,
        },
        { userId: actorUserId, tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarEvent',
        aggregateId: event.id,
        eventType: 'business_calendar_event.created',
        dedupeKey: `business_calendar_event.created:${event.id}`,
        companyId: event.companyId,
        branchId: version.calendar.branchId,
        payload: {
          versionId: version.id,
          eventId: event.id,
          effect: event.businessDayEffect,
        },
      });

      return event;
    });

    return created;
  }

  async updateEvent(
    eventId: string,
    dto: UpdateBusinessCalendarEventDto,
    actorUserId: string,
  ) {
    const existing = await this.getEvent(eventId);
    const version = await this.versions.requireVersion(
      existing.calendarVersionId,
    );
    this.versions.assertDraftEditable(version);

    const merged: CreateBusinessCalendarEventDto = {
      eventTypeId: dto.eventTypeId ?? existing.eventTypeId,
      eventCategoryId: dto.eventCategoryId ?? existing.eventCategoryId,
      eventSourceId: dto.eventSourceId ?? existing.eventSourceId,
      eventCode:
        dto.eventCode === undefined
          ? (existing.eventCode ?? undefined)
          : (dto.eventCode ?? undefined),
      eventName: dto.eventName ?? existing.eventName,
      description:
        dto.description === undefined
          ? (existing.description ?? undefined)
          : (dto.description ?? undefined),
      allDay: dto.allDay ?? existing.allDay,
      startDate: dto.startDate ?? existing.startDate.toISOString().slice(0, 10),
      endDate: dto.endDate ?? existing.endDate.toISOString().slice(0, 10),
      startsAt:
        dto.startsAt === undefined
          ? existing.startsAt?.toISOString()
          : (dto.startsAt ?? undefined),
      endsAt:
        dto.endsAt === undefined
          ? existing.endsAt?.toISOString()
          : (dto.endsAt ?? undefined),
      eventTimezone:
        dto.eventTimezone === undefined
          ? (existing.eventTimezone ?? undefined)
          : (dto.eventTimezone ?? undefined),
      businessDayEffect: dto.businessDayEffect ?? existing.businessDayEffect,
      paidHoliday: dto.paidHoliday ?? existing.paidHoliday,
      isOptionalHoliday: dto.isOptionalHoliday ?? existing.isOptionalHoliday,
      isProtected: dto.isProtected ?? existing.isProtected,
      targets:
        dto.targets ??
        existing.targets.map((target) => ({
          targetType: target.targetType,
          companyId: target.companyId,
          branchId: target.branchId ?? undefined,
          departmentId: target.departmentId ?? undefined,
          employeeId: target.employeeId ?? undefined,
          projectId: target.projectId ?? undefined,
        })),
    };

    const normalized = await this.normalizeEventInput(version, merged);

    return this.prisma.$transaction(async (tx) => {
      await tx.businessCalendarEventTarget.deleteMany({
        where: { eventId: existing.id },
      });

      const event = await tx.businessCalendarEvent.update({
        where: { id: existing.id },
        data: {
          eventTypeId: normalized.eventTypeId,
          eventCategoryId: normalized.eventCategoryId,
          eventSourceId: normalized.eventSourceId,
          eventCode: normalized.eventCode,
          eventName: normalized.eventName,
          description: normalized.description,
          allDay: normalized.allDay,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          startsAt: normalized.startsAt,
          endsAt: normalized.endsAt,
          eventTimezone: normalized.eventTimezone,
          businessDayEffect: normalized.businessDayEffect,
          paidHoliday: normalized.paidHoliday,
          isOptionalHoliday: normalized.isOptionalHoliday,
          isProtected: normalized.isProtected,
          targets: {
            create: normalized.targets.map((target) => ({
              targetType: target.targetType,
              companyId: target.companyId,
              branchId: target.branchId ?? null,
              departmentId: target.departmentId ?? null,
              employeeId: target.employeeId ?? null,
              projectId: target.projectId ?? null,
            })),
          },
        },
        include: this.eventInclude(),
      });

      await tx.businessCalendarVersion.update({
        where: { id: version.id },
        data: { optimisticVersion: { increment: 1 } },
      });
      await this.versions.refreshChecksum(tx, version.id);

      await this.auditService.log(
        'BusinessCalendarEvent',
        event.id,
        'UPDATE',
        { eventName: existing.eventName },
        {
          eventName: event.eventName,
          businessDayEffect: event.businessDayEffect,
        },
        { userId: actorUserId, tx },
      );

      return event;
    });
  }

  async deleteEvent(eventId: string, actorUserId: string) {
    const existing = await this.getEvent(eventId);
    const version = await this.versions.requireVersion(
      existing.calendarVersionId,
    );
    this.versions.assertDraftEditable(version);

    if (existing.isProtected) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_PROTECTED_OVERRIDE_FORBIDDEN,
        message: 'Protected events cannot be deleted without elevated override',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.businessCalendarEvent.delete({ where: { id: existing.id } });
      await tx.businessCalendarVersion.update({
        where: { id: version.id },
        data: { optimisticVersion: { increment: 1 } },
      });
      await this.versions.refreshChecksum(tx, version.id);
      await this.auditService.log(
        'BusinessCalendarEvent',
        existing.id,
        'DELETE',
        { eventName: existing.eventName },
        undefined,
        { userId: actorUserId, tx },
      );
      await this.outboxWriter.write(tx, {
        aggregateType: 'BusinessCalendarEvent',
        aggregateId: existing.id,
        eventType: 'business_calendar_event.deleted',
        dedupeKey: `business_calendar_event.deleted:${existing.id}`,
        companyId: existing.companyId,
        branchId: version.calendar.branchId,
        payload: { versionId: version.id, eventId: existing.id },
      });
    });

    return { deleted: true, id: existing.id };
  }

  private async normalizeEventInput(
    version: {
      calendar: {
        companyId: string;
        branchId: string | null;
        scope: BusinessCalendarScope;
        defaultTimezone: string;
      };
    },
    dto: CreateBusinessCalendarEventDto,
  ) {
    const startDate = this.parseDateOnly(dto.startDate);
    const endDate = this.parseDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
        message: 'endDate cannot precede startDate',
      });
    }

    const [eventType, eventCategory, eventSource] = await Promise.all([
      this.prisma.businessCalendarEventType.findFirst({
        where: {
          id: dto.eventTypeId,
          isActive: true,
          OR: [{ companyId: null }, { companyId: version.calendar.companyId }],
        },
      }),
      this.prisma.businessCalendarEventCategory.findFirst({
        where: {
          id: dto.eventCategoryId,
          isActive: true,
          OR: [{ companyId: null }, { companyId: version.calendar.companyId }],
        },
      }),
      this.prisma.businessCalendarEventSource.findFirst({
        where: {
          id: dto.eventSourceId,
          isActive: true,
          OR: [{ companyId: null }, { companyId: version.calendar.companyId }],
        },
      }),
    ]);

    if (!eventType || !eventCategory || !eventSource) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
        message: 'Event type, category or source is invalid for this company',
      });
    }

    const effect = dto.businessDayEffect ?? BusinessDayEffect.NONE;
    if (
      effect !== BusinessDayEffect.NONE &&
      !eventType.allowsBusinessDayEffect
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
        message: `Event type ${eventType.eventTypeCode} does not allow business-day effects`,
      });
    }

    const paidHoliday = dto.paidHoliday ?? false;
    if (paidHoliday) {
      if (eventType.eventTypeCode !== 'HOLIDAY') {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'paidHoliday is only allowed for HOLIDAY events',
        });
      }
      if (!NON_WORKING_EFFECTS.has(effect)) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'paidHoliday requires a non-working holiday effect',
        });
      }
    }

    const isOptionalHoliday = dto.isOptionalHoliday ?? false;
    if (isOptionalHoliday) {
      if (eventType.eventTypeCode !== 'HOLIDAY') {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'Optional holidays must use the HOLIDAY event type',
        });
      }
      if (!dto.allDay) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'Optional holidays must be all-day events',
        });
      }
      if (startDate.getTime() !== endDate.getTime()) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'Optional holidays must be a single calendar date',
        });
      }
      if (effect !== BusinessDayEffect.NONE) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message:
            'Optional holidays must use business-day effect NONE so the office stays open',
        });
      }
      if (paidHoliday) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message:
            'Optional holidays cannot be marked paidHoliday at calendar level',
        });
      }
      if (HALF_DAY_EFFECTS.has(effect)) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'Optional holidays cannot be half-day events',
        });
      }
    }

    if (HALF_DAY_EFFECTS.has(effect) && !dto.allDay) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
        message: 'Half-day holiday effects require an all-day event',
      });
    }

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    let eventTimezone: string | null = null;

    if (dto.allDay) {
      if (dto.startsAt || dto.endsAt) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'All-day events must not include startsAt/endsAt',
        });
      }
    } else {
      if (!dto.startsAt || !dto.endsAt || !dto.eventTimezone) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
          message: 'Timed events require startsAt, endsAt and eventTimezone',
        });
      }
      if (!isValidIanaTimeZone(dto.eventTimezone)) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
          message: 'eventTimezone must be a valid IANA timezone',
        });
      }
      startsAt = new Date(dto.startsAt);
      endsAt = new Date(dto.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('Invalid startsAt/endsAt');
      }
      if (endsAt < startsAt) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message: 'endsAt cannot precede startsAt',
        });
      }
      eventTimezone = dto.eventTimezone;
    }

    const targets = await this.validateTargets(
      version.calendar.companyId,
      version.calendar.branchId,
      version.calendar.scope,
      effect,
      dto.targets,
    );

    if (isOptionalHoliday) {
      const invalidTarget = targets.find(
        (target) => !EFFECT_TARGETS.has(target.targetType),
      );
      if (invalidTarget) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
          message: 'Optional holidays may only target COMPANY or BRANCH scopes',
        });
      }
    }

    return {
      eventTypeId: eventType.id,
      eventCategoryId: eventCategory.id,
      eventSourceId: eventSource.id,
      eventCode: dto.eventCode?.trim().toUpperCase() || null,
      eventName: dto.eventName.trim(),
      description: dto.description?.trim() || null,
      allDay: dto.allDay,
      startDate,
      endDate,
      startsAt,
      endsAt,
      eventTimezone,
      businessDayEffect: effect,
      paidHoliday,
      isOptionalHoliday,
      isProtected: dto.isProtected ?? false,
      targets,
    };
  }

  private async validateTargets(
    companyId: string,
    calendarBranchId: string | null,
    scope: BusinessCalendarScope,
    effect: BusinessDayEffect,
    targets: EventTargetDto[],
  ) {
    if (targets.length === 0) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
        message: 'At least one event target is required',
      });
    }

    const normalized: EventTargetDto[] = [];
    for (const target of targets) {
      if (target.companyId !== companyId) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
          message: 'Event target company must match the calendar company',
        });
      }

      const filled = [
        target.branchId,
        target.departmentId,
        target.employeeId,
        target.projectId,
      ].filter(Boolean).length;

      switch (target.targetType) {
        case CalendarEventTargetType.COMPANY:
          if (filled !== 0) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message:
                'COMPANY targets must not set branch/department/employee/project',
            });
          }
          break;
        case CalendarEventTargetType.BRANCH:
          if (!target.branchId || filled !== 1) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message: 'BRANCH targets require only branchId',
            });
          }
          await this.assertBranchInCompany(target.branchId, companyId);
          if (
            scope === BusinessCalendarScope.BRANCH &&
            calendarBranchId &&
            target.branchId !== calendarBranchId
          ) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message:
                'Branch calendar events can only target their own branch',
            });
          }
          break;
        case CalendarEventTargetType.DEPARTMENT:
          if (!target.departmentId || filled !== 1) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message: 'DEPARTMENT targets require only departmentId',
            });
          }
          await this.assertDepartmentInCompany(target.departmentId, companyId);
          break;
        case CalendarEventTargetType.EMPLOYEE:
          if (!target.employeeId || filled !== 1) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message: 'EMPLOYEE targets require only employeeId',
            });
          }
          await this.assertEmployeeInCompany(target.employeeId, companyId);
          break;
        case CalendarEventTargetType.PROJECT:
          if (!target.projectId || filled !== 1) {
            throw new BadRequestException({
              code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
              message: 'PROJECT targets require only projectId',
            });
          }
          await this.assertProjectInCompany(target.projectId, companyId);
          break;
        default:
          throw new BadRequestException({
            code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
            message: 'Unsupported target type',
          });
      }

      if (
        effect !== BusinessDayEffect.NONE &&
        !EFFECT_TARGETS.has(target.targetType)
      ) {
        throw new BadRequestException({
          code: BusinessCalendarErrorCode.CALENDAR_EVENT_EFFECT_INVALID,
          message:
            'Department/Employee/Project targets are informational and cannot set business-day effects',
        });
      }

      normalized.push(target);
    }

    return normalized;
  }

  private async assertBranchInCompany(branchId: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        ...this.employeeDomainScope.branchWhere(),
      },
    });
    if (!branch) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
        message: 'Branch target is out of tenant scope',
      });
    }
  }

  private async assertDepartmentInCompany(
    departmentId: string,
    companyId: string,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId },
    });
    if (!department) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
        message: 'Department target is out of tenant scope',
      });
    }
  }

  private async assertEmployeeInCompany(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        ...this.employeeDomainScope.employeeWhere(),
      },
    });
    if (!employee) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
        message: 'Employee target is out of tenant scope',
      });
    }
  }

  private async assertProjectInCompany(projectId: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_EVENT_TARGET_INVALID,
        message: 'Project target is out of tenant scope',
      });
    }
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private eventInclude() {
    return {
      eventType: true,
      eventCategory: true,
      eventSource: true,
      targets: true,
    } satisfies Prisma.BusinessCalendarEventInclude;
  }
}
