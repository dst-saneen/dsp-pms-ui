import { Injectable } from '@nestjs/common';
import { EmployeeOnboarding, Prisma } from '@prisma/client';

import { BaseRepository } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import { EmployeeOnboardingQueryDto } from '../dto/employee-onboarding-query.dto';

@Injectable()
export class EmployeeOnboardingRepository extends BaseRepository<
  EmployeeOnboarding,
  Prisma.EmployeeOnboardingFindUniqueArgs,
  Prisma.EmployeeOnboardingFindFirstArgs,
  Prisma.EmployeeOnboardingFindManyArgs,
  Prisma.EmployeeOnboardingCreateArgs,
  Prisma.EmployeeOnboardingUpdateArgs,
  Prisma.EmployeeOnboardingDeleteArgs,
  Prisma.EmployeeOnboardingCountArgs
> {
  constructor(prisma: PrismaService) {
    super(prisma.employeeOnboarding, 'Employee Onboarding');
  }

  private readonly onboardingInclude = {
    employee: true,
    template: true,
    templateVersion: true,
    tasks: {
      orderBy: {
        sequenceNo: 'asc',
      },
      include: {
        assignedDepartment: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
          },
        },
      },
    },
  } satisfies Prisma.EmployeeOnboardingInclude;

  private readonly sortableFields = {
    createdAt: 'createdAt',
    startDate: 'startDate',
    status: 'status',
  } as const;

  async findWithRelations(
    id: string,
    scopeWhere?: Prisma.EmployeeOnboardingWhereInput,
  ) {
    return this.repository.findFirst({
      where: {
        id,
        ...scopeWhere,
      },
      include: this.onboardingInclude,
    });
  }

  async findByEmployee(
    employeeId: string,
    scopeWhere?: Prisma.EmployeeOnboardingWhereInput,
  ) {
    return this.repository.findFirst({
      where: {
        employeeId,
        ...scopeWhere,
      },
      include: this.onboardingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByEmployee(
    employeeId: string,
    scopeWhere?: Prisma.EmployeeOnboardingWhereInput,
  ) {
    return this.repository.findFirst({
      where: {
        employeeId,
        status: 'IN_PROGRESS',
        ...scopeWhere,
      },
      include: this.onboardingInclude,
    });
  }

  async search(
    query: EmployeeOnboardingQueryDto,
    scopeWhere?: Prisma.EmployeeOnboardingWhereInput,
  ) {
    const where: Prisma.EmployeeOnboardingWhereInput = {
      ...scopeWhere,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.templateId && { templateId: query.templateId }),
      ...(query.status && { status: query.status }),
      ...(query.keyword && {
        OR: [
          {
            employee: {
              firstName: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
          },
          {
            employee: {
              lastName: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
          },
          {
            employee: {
              employeeCode: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
          },
        ],
      }),
    };

    const sortBy =
      this.sortableFields[query.sortBy as keyof typeof this.sortableFields] ??
      'createdAt';

    const sortOrder = query.sortOrder;

    return this.repository.findMany({
      where,
      include: this.onboardingInclude,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });
  }

  async getSummary(where?: Prisma.EmployeeOnboardingWhereInput) {
    const scopeWhere = where ?? {};

    const [total, inProgress, completed, cancelled] = await Promise.all([
      this.repository.count({ where: scopeWhere }),
      this.repository.count({
        where: {
          ...scopeWhere,
          status: 'IN_PROGRESS',
        },
      }),
      this.repository.count({
        where: {
          ...scopeWhere,
          status: 'COMPLETED',
        },
      }),
      this.repository.count({
        where: {
          ...scopeWhere,
          status: 'CANCELLED',
        },
      }),
    ]);

    return {
      total,
      inProgress,
      completed,
      cancelled,
    };
  }
}
