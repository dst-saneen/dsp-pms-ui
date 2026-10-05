import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CalendarImpactStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';

@Injectable()
export class BusinessCalendarImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: {
    companyId?: string;
    branchId?: string;
    status?: CalendarImpactStatus;
  }) {
    const where: Prisma.BusinessCalendarImpactWhereInput = {
      company: this.employeeDomainScope.companyWhere(),
    };
    if (query.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(query.companyId);
      where.companyId = query.companyId;
    }
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;

    return this.prisma.businessCalendarImpact.findMany({
      where,
      include: {
        branch: {
          select: { id: true, branchCode: true, branchName: true },
        },
        amendment: {
          select: {
            id: true,
            reason: true,
            effectiveDate: true,
            amendmentVersionId: true,
            calendarId: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { businessDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    });
  }

  async resolve(
    impactId: string,
    input: { resolutionReason?: string },
    actorUserId: string,
  ) {
    const impact = await this.prisma.businessCalendarImpact.findFirst({
      where: {
        id: impactId,
        company: this.employeeDomainScope.companyWhere(),
      },
    });
    if (!impact) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Impact not found',
      });
    }
    await this.employeeDomainScope.assertCompanyInScope(impact.companyId);

    if (impact.status === CalendarImpactStatus.RESOLVED) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_IMPACT_REVIEW_REQUIRED,
        message: 'Impact is already resolved',
      });
    }

    const updated = await this.prisma.businessCalendarImpact.update({
      where: { id: impact.id },
      data: {
        status: CalendarImpactStatus.RESOLVED,
        resolvedByUserId: actorUserId,
        resolvedAt: new Date(),
        resolutionReason: input.resolutionReason?.trim() || null,
      },
    });

    await this.auditService.log(
      'BusinessCalendarImpact',
      impact.id,
      'RESOLVE',
      { status: impact.status },
      { status: updated.status, resolutionReason: updated.resolutionReason },
      { userId: actorUserId },
    );

    return updated;
  }
}
