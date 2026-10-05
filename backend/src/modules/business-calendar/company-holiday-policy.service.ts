import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTypeCategory, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { UpsertCompanyHolidayPolicyDto } from './dto/company-holiday-policy.dto';

@Injectable()
export class CompanyHolidayPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async find(companyId: string, year?: number) {
    await this.employeeDomainScope.assertCompanyInScope(companyId);

    const where: Prisma.CompanyHolidayPolicyWhereInput = {
      companyId,
      isActive: true,
    };
    if (year != null) {
      where.year = year;
    }

    return this.prisma.companyHolidayPolicy.findMany({
      where,
      include: {
        optionalHolidayLeaveType: {
          select: {
            id: true,
            leaveCode: true,
            leaveName: true,
            category: true,
            isActive: true,
          },
        },
      },
      orderBy: { year: 'desc' },
    });
  }

  async upsert(
    companyId: string,
    year: number,
    dto: UpsertCompanyHolidayPolicyDto,
  ) {
    await this.employeeDomainScope.assertCompanyInScope(companyId);
    this.assertYear(year);

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: dto.optionalHolidayLeaveTypeId,
        companyId,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
      select: {
        id: true,
        category: true,
      },
    });

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: 'Optional holiday leave type not found for this company',
      });
    }

    if (leaveType.category !== LeaveTypeCategory.OPTIONAL_HOLIDAY) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          'optionalHolidayLeaveTypeId must reference an active OPTIONAL_HOLIDAY leave type',
      });
    }

    return this.prisma.companyHolidayPolicy.upsert({
      where: {
        companyId_year: { companyId, year },
      },
      create: {
        companyId,
        year,
        maximumHolidayDays: dto.maximumHolidayDays,
        optionalHolidayLeaveTypeId: dto.optionalHolidayLeaveTypeId,
        isActive: true,
      },
      update: {
        maximumHolidayDays: dto.maximumHolidayDays,
        optionalHolidayLeaveTypeId: dto.optionalHolidayLeaveTypeId,
        isActive: true,
      },
      include: {
        optionalHolidayLeaveType: {
          select: {
            id: true,
            leaveCode: true,
            leaveName: true,
            category: true,
            isActive: true,
          },
        },
      },
    });
  }

  private assertYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'year must be between 2000 and 2100',
      });
    }
  }
}
