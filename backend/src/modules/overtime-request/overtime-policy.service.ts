import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService, OrganizationScopeService } from '../auth';

import {
  CreateOvertimePolicyDto,
  OvertimePolicyFilterDto,
  UpdateOvertimePolicyDto,
} from '../overtime-request/dto';

@Injectable()
export class OvertimePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly organizationScope: OrganizationScopeService,
  ) {}

  async findAll(filters: OvertimePolicyFilterDto) {
    const where: Prisma.OvertimePolicyWhereInput = {
      ...this.employeeDomainScope.overtimePolicyWhere(),
      isActive: true,
    };
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.branchId) where.branchId = filters.branchId;

    return this.prisma.overtimePolicy.findMany({
      where,
      orderBy: [{ companyId: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.overtimePolicy.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.overtimePolicyWhere(),
      },
    });
    if (!row) {
      throw new NotFoundException('Overtime policy not found');
    }
    return row;
  }

  async create(dto: CreateOvertimePolicyDto, actor: AuthenticatedUser) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    if (dto.branchId) {
      await this.organizationScope.assertCurrentBranch(dto.branchId);
    }

    return this.prisma.overtimePolicy.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        minimumEligibleMinutes: dto.minimumEligibleMinutes,
        roundingMinutes: dto.roundingMinutes,
        includeEarlyArrival: dto.includeEarlyArrival,
        requireScheduledMinutesFulfilled: dto.requireScheduledMinutesFulfilled,
        allowCompOff: dto.allowCompOff,
        allowPayrollPending: dto.allowPayrollPending,
        compOffHalfDayMinutes: dto.compOffHalfDayMinutes,
        compOffFullDayMinutes: dto.compOffFullDayMinutes,
        maxCompOffDaysPerSource: dto.maxCompOffDaysPerSource,
        compOffExpiryDays: dto.compOffExpiryDays,
        maxDailyMinutes: dto.maxDailyMinutes,
        maxMonthlyMinutes: dto.maxMonthlyMinutes,
        requiresApproval: dto.requiresApproval,
        createdByUserId: actor.id,
      },
    });
  }

  async update(id: string, dto: UpdateOvertimePolicyDto) {
    await this.findOne(id);
    return this.prisma.overtimePolicy.update({
      where: { id },
      data: {
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo:
                dto.effectiveTo === null ? null : new Date(dto.effectiveTo),
            }
          : {}),
        ...(dto.minimumEligibleMinutes !== undefined
          ? { minimumEligibleMinutes: dto.minimumEligibleMinutes }
          : {}),
        ...(dto.roundingMinutes !== undefined
          ? { roundingMinutes: dto.roundingMinutes }
          : {}),
        ...(dto.includeEarlyArrival !== undefined
          ? { includeEarlyArrival: dto.includeEarlyArrival }
          : {}),
        ...(dto.requireScheduledMinutesFulfilled !== undefined
          ? {
              requireScheduledMinutesFulfilled:
                dto.requireScheduledMinutesFulfilled,
            }
          : {}),
        ...(dto.allowCompOff !== undefined
          ? { allowCompOff: dto.allowCompOff }
          : {}),
        ...(dto.allowPayrollPending !== undefined
          ? { allowPayrollPending: dto.allowPayrollPending }
          : {}),
        ...(dto.compOffHalfDayMinutes !== undefined
          ? { compOffHalfDayMinutes: dto.compOffHalfDayMinutes }
          : {}),
        ...(dto.compOffFullDayMinutes !== undefined
          ? { compOffFullDayMinutes: dto.compOffFullDayMinutes }
          : {}),
        ...(dto.maxCompOffDaysPerSource !== undefined
          ? { maxCompOffDaysPerSource: dto.maxCompOffDaysPerSource }
          : {}),
        ...(dto.compOffExpiryDays !== undefined
          ? { compOffExpiryDays: dto.compOffExpiryDays }
          : {}),
        ...(dto.maxDailyMinutes !== undefined
          ? { maxDailyMinutes: dto.maxDailyMinutes }
          : {}),
        ...(dto.maxMonthlyMinutes !== undefined
          ? { maxMonthlyMinutes: dto.maxMonthlyMinutes }
          : {}),
        ...(dto.requiresApproval !== undefined
          ? { requiresApproval: dto.requiresApproval }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
