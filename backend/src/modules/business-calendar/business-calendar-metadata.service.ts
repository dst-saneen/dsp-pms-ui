import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import {
  CreateEventCategoryDto,
  CreateEventSourceDto,
  CreateEventTypeDto,
  UpdateEventCategoryDto,
  UpdateEventSourceDto,
  UpdateEventTypeDto,
} from './dto/business-calendar-version.dto';

@Injectable()
export class BusinessCalendarMetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  listEventTypes(companyId?: string) {
    return this.prisma.businessCalendarEventType.findMany({
      where: this.lookupWhere(companyId),
      orderBy: [{ displayOrder: 'asc' }, { eventTypeName: 'asc' }],
    });
  }

  listCategories(companyId?: string) {
    return this.prisma.businessCalendarEventCategory.findMany({
      where: this.lookupWhere(companyId),
      orderBy: [{ displayOrder: 'asc' }, { categoryName: 'asc' }],
    });
  }

  listSources(companyId?: string) {
    return this.prisma.businessCalendarEventSource.findMany({
      where: this.lookupWhere(companyId),
      orderBy: [{ displayOrder: 'asc' }, { sourceName: 'asc' }],
    });
  }

  async createEventType(dto: CreateEventTypeDto, actorUserId: string) {
    if (dto.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    }
    const code = dto.eventTypeCode.trim().toUpperCase();
    const scopeKey = dto.companyId
      ? `COMPANY:${dto.companyId}:${code}`
      : `GLOBAL:${code}`;

    const created = await this.prisma.businessCalendarEventType.create({
      data: {
        companyId: dto.companyId ?? null,
        scopeKey,
        eventTypeCode: code,
        eventTypeName: dto.eventTypeName.trim(),
        description: dto.description?.trim() || null,
        allowsBusinessDayEffect: dto.allowsBusinessDayEffect ?? false,
        isSystem: false,
        displayOrder: dto.displayOrder ?? 100,
        colorToken: dto.colorToken ?? null,
        iconKey: dto.iconKey ?? null,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventType',
      created.id,
      'CREATE',
      undefined,
      { scopeKey, eventTypeCode: code },
      { userId: actorUserId },
    );

    return created;
  }

  async updateEventType(
    id: string,
    dto: UpdateEventTypeDto,
    actorUserId: string,
  ) {
    const current = await this.requireType(id);
    if (
      current.isSystem &&
      dto.allowsBusinessDayEffect === false &&
      current.eventTypeCode === 'HOLIDAY'
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_PROTECTED_METADATA,
        message: 'HOLIDAY system type cannot disallow business-day effects',
      });
    }

    const updated = await this.prisma.businessCalendarEventType.update({
      where: { id },
      data: {
        eventTypeName: dto.eventTypeName?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description,
        allowsBusinessDayEffect: current.isSystem
          ? current.eventTypeCode === 'HOLIDAY'
            ? true
            : dto.allowsBusinessDayEffect
          : dto.allowsBusinessDayEffect,
        isActive: dto.isActive,
        displayOrder: dto.displayOrder,
        colorToken: dto.colorToken === undefined ? undefined : dto.colorToken,
        iconKey: dto.iconKey === undefined ? undefined : dto.iconKey,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventType',
      updated.id,
      'UPDATE',
      { eventTypeName: current.eventTypeName },
      { eventTypeName: updated.eventTypeName },
      { userId: actorUserId },
    );

    return updated;
  }

  async createCategory(dto: CreateEventCategoryDto, actorUserId: string) {
    if (dto.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    }
    const code = dto.categoryCode.trim().toUpperCase();
    const scopeKey = dto.companyId
      ? `COMPANY:${dto.companyId}:${code}`
      : `GLOBAL:${code}`;

    const created = await this.prisma.businessCalendarEventCategory.create({
      data: {
        companyId: dto.companyId ?? null,
        scopeKey,
        categoryCode: code,
        categoryName: dto.categoryName.trim(),
        description: dto.description?.trim() || null,
        isSystem: false,
        displayOrder: dto.displayOrder ?? 100,
        colorToken: dto.colorToken ?? null,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventCategory',
      created.id,
      'CREATE',
      undefined,
      { scopeKey, categoryCode: code },
      { userId: actorUserId },
    );

    return created;
  }

  async updateCategory(
    id: string,
    dto: UpdateEventCategoryDto,
    actorUserId: string,
  ) {
    const current = await this.requireCategory(id);
    const updated = await this.prisma.businessCalendarEventCategory.update({
      where: { id },
      data: {
        categoryName: dto.categoryName?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description,
        isActive: dto.isActive,
        displayOrder: dto.displayOrder,
        colorToken: dto.colorToken === undefined ? undefined : dto.colorToken,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventCategory',
      updated.id,
      'UPDATE',
      { categoryName: current.categoryName },
      { categoryName: updated.categoryName },
      { userId: actorUserId },
    );

    return updated;
  }

  async createSource(dto: CreateEventSourceDto, actorUserId: string) {
    if (dto.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(dto.companyId);
    }
    const code = dto.sourceCode.trim().toUpperCase();
    const scopeKey = dto.companyId
      ? `COMPANY:${dto.companyId}:${code}`
      : `GLOBAL:${code}`;

    const created = await this.prisma.businessCalendarEventSource.create({
      data: {
        companyId: dto.companyId ?? null,
        scopeKey,
        sourceCode: code,
        sourceName: dto.sourceName.trim(),
        sourceKind: dto.sourceKind,
        description: dto.description?.trim() || null,
        isSystem: false,
        displayOrder: dto.displayOrder ?? 100,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventSource',
      created.id,
      'CREATE',
      undefined,
      { scopeKey, sourceCode: code },
      { userId: actorUserId },
    );

    return created;
  }

  async updateSource(
    id: string,
    dto: UpdateEventSourceDto,
    actorUserId: string,
  ) {
    const current = await this.requireSource(id);
    const updated = await this.prisma.businessCalendarEventSource.update({
      where: { id },
      data: {
        sourceName: dto.sourceName?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description,
        isActive: dto.isActive,
        displayOrder: dto.displayOrder,
      },
    });

    await this.auditService.log(
      'BusinessCalendarEventSource',
      updated.id,
      'UPDATE',
      { sourceName: current.sourceName },
      { sourceName: updated.sourceName },
      { userId: actorUserId },
    );

    return updated;
  }

  private lookupWhere(companyId?: string) {
    if (companyId) {
      return {
        OR: [{ companyId: null }, { companyId }],
      };
    }
    return {
      OR: [
        { companyId: null },
        { company: this.employeeDomainScope.companyWhere() },
      ],
    };
  }

  private async requireType(id: string) {
    const row = await this.prisma.businessCalendarEventType.findFirst({
      where: {
        id,
        OR: [
          { companyId: null },
          { company: this.employeeDomainScope.companyWhere() },
        ],
      },
    });
    if (!row) {
      throw new NotFoundException('Event type not found');
    }
    return row;
  }

  private async requireCategory(id: string) {
    const row = await this.prisma.businessCalendarEventCategory.findFirst({
      where: {
        id,
        OR: [
          { companyId: null },
          { company: this.employeeDomainScope.companyWhere() },
        ],
      },
    });
    if (!row) {
      throw new NotFoundException('Event category not found');
    }
    return row;
  }

  private async requireSource(id: string) {
    const row = await this.prisma.businessCalendarEventSource.findFirst({
      where: {
        id,
        OR: [
          { companyId: null },
          { company: this.employeeDomainScope.companyWhere() },
        ],
      },
    });
    if (!row) {
      throw new NotFoundException('Event source not found');
    }
    return row;
  }
}
