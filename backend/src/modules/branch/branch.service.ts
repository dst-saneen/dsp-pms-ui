import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

import { CreateBranchDto } from './dto/create-branch.dto';

import { UpdateBranchDto } from './dto/update-branch.dto';
import { ReplaceBranchWorkingDaysDto } from './dto/replace-branch-working-days.dto';
import { OrganizationScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

const DEFAULT_WORKING_DAY_ROWS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
}));

@Injectable()
export class BranchService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateBranchDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const branchCode = await this.numberSeries.next(
      'BRANCH',
      dto.companyId,
      'BR',
    );
    const branch = await this.prisma.branch.create({
      data: {
        ...dto,
        branchCode,
        workingDays: {
          create: DEFAULT_WORKING_DAY_ROWS,
        },
      },
      include: {
        workingDays: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    await this.auditService.log('Branch', branch.id, 'CREATE', null, branch);

    return branch;
  }

  async findAll(companyId?: string) {
    const scope = this.organizationScope.current();
    const scopedBranchId = this.organizationScope.branchIdOrUndefined();

    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }

    const include = {
      company: {
        select: {
          id: true,
          companyCode: true,
          companyName: true,
        },
      },
    } as const;

    // Branch-scoped users only see their active Branch.
    if (scopedBranchId) {
      return this.prisma.branch.findMany({
        where: {
          id: scopedBranchId,
          ...(companyId ? { companyId } : {}),
        },
        include,
        orderBy: {
          branchName: 'asc',
        },
      });
    }

    // Company Group owners/admins: show all Branches in the Group unless a
    // company filter is supplied. Do not silently hide other companies' Branches
    // just because an activeCompanyId is set for workspace context.
    if (
      !scope.isGlobal &&
      scope.scopeLevel === 'COMPANY_GROUP' &&
      scope.activeCompanyGroupId
    ) {
      return this.prisma.branch.findMany({
        where: companyId
          ? { companyId }
          : {
              company: {
                companyGroupId: scope.activeCompanyGroupId,
              },
            },
        include,
        orderBy: {
          branchName: 'asc',
        },
      });
    }

    const scopedCompanyId =
      companyId ?? this.organizationScope.companyIdOrUndefined();

    return this.prisma.branch.findMany({
      where: {
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      },
      include,
      orderBy: {
        branchName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const companyId = this.organizationScope.companyIdOrUndefined();
    const branchId = this.organizationScope.branchIdOrUndefined();

    if (branchId && branchId !== id) {
      throw new NotFoundException('Branch not found');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    const oldBranch = await this.findOne(id);

    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'Branch',
      id,
      'UPDATE',
      oldBranch,
      updatedBranch,
    );

    return updatedBranch;
  }

  async remove(id: string) {
    const branch = await this.findOne(id);

    await this.auditService.log('Branch', id, 'DELETE', branch, null);

    return this.prisma.branch.delete({
      where: { id },
    });
  }

  async getWorkingDays(branchId: string) {
    await this.findOne(branchId);
    const days = await this.prisma.branchWorkingDay.findMany({
      where: { branchId },
      orderBy: { dayOfWeek: 'asc' },
    });

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        branchName: true,
        timezone: true,
        workingCalendarReviewedAt: true,
      },
    });

    return {
      branch,
      days:
        days.length === 7
          ? days
          : DEFAULT_WORKING_DAY_ROWS.map((row) => ({
              ...row,
              id: null,
              branchId,
            })),
      needsReview: !branch?.workingCalendarReviewedAt,
    };
  }

  async replaceWorkingDays(branchId: string, dto: ReplaceBranchWorkingDaysDto) {
    await this.findOne(branchId);

    const uniqueDays = new Set(dto.days.map((day) => day.dayOfWeek));
    if (
      uniqueDays.size !== 7 ||
      ![0, 1, 2, 3, 4, 5, 6].every((d) => uniqueDays.has(d))
    ) {
      throw new BadRequestException(
        'Working calendar must include each dayOfWeek 0–6 exactly once',
      );
    }

    if (!dto.days.some((day) => day.isWorkingDay)) {
      throw new BadRequestException('At least one working day is required');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.branchWorkingDay.deleteMany({ where: { branchId } });
      await tx.branchWorkingDay.createMany({
        data: dto.days.map((day) => ({
          branchId,
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: day.isWorkingDay,
        })),
      });

      if (dto.markReviewed) {
        await tx.branch.update({
          where: { id: branchId },
          data: { workingCalendarReviewedAt: new Date() },
        });
      }
    });

    return this.getWorkingDays(branchId);
  }
}
