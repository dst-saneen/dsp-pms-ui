import { Injectable, NotFoundException } from '@nestjs/common';
import { JobOpeningStatus, Prisma } from '@prisma/client';

import { DomainConflictException, getRequestActor } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import {
  getJobOpeningAllowedActions,
  JobOpeningTransitionService,
} from '../transitions';

import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { JobOpeningCriterionDto } from './dto/job-opening-criterion.dto';
import { SearchJobOpeningDto } from './dto/search-job-opening.dto';
import { UpdateJobOpeningDto } from './dto/update-job-opening.dto';

const jobOpeningInclude = {
  criteria: {
    orderBy: { displayOrder: 'asc' as const },
  },
  company: { select: { id: true, companyName: true, companyCode: true } },
  branch: { select: { id: true, branchName: true, branchCode: true } },
  department: {
    select: { id: true, departmentName: true, departmentCode: true },
  },
  designation: {
    select: { id: true, designationName: true, designationCode: true },
  },
  hiringManager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
} satisfies Prisma.JobOpeningInclude;

@Injectable()
export class JobOpeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly employeeScope: EmployeeDomainScopeService,
    private readonly openingTransitions: JobOpeningTransitionService,
  ) {}

  async create(dto: CreateJobOpeningDto) {
    const hierarchy = await this.validateOpeningHierarchy({
      companyId: dto.companyId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      designationId: dto.designationId,
      hiringManagerEmployeeId: dto.hiringManagerEmployeeId,
    });
    this.openingTransitions.validateCriteriaTotal(dto.criteria);

    const actor = getRequestActor();
    const openingCode = await this.generateOpeningCode(dto.companyId);

    const opening = await this.prisma.jobOpening.create({
      data: {
        openingCode,
        companyGroupId: hierarchy.companyGroupId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        hiringManagerEmployeeId: dto.hiringManagerEmployeeId,
        title: dto.title,
        description: dto.description,
        employmentType: dto.employmentType,
        location: dto.location,
        headcountTotal: dto.headcountTotal ?? 1,
        targetJoiningDate: dto.targetJoiningDate
          ? new Date(dto.targetJoiningDate)
          : undefined,
        applicationDeadline: dto.applicationDeadline
          ? new Date(dto.applicationDeadline)
          : undefined,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        criteria: {
          create: dto.criteria.map((criterion) =>
            this.mapCriterionCreate(criterion),
          ),
        },
      },
      include: jobOpeningInclude,
    });

    return this.withAllowedActions(opening);
  }

  async findAll(query: SearchJobOpeningDto) {
    const where: Prisma.JobOpeningWhereInput = {
      ...this.scope.jobOpeningWhere(),
    };

    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.designationId) {
      where.designationId = query.designationId;
    }
    if (query.hiringManagerEmployeeId) {
      where.hiringManagerEmployeeId = query.hiringManagerEmployeeId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { openingCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.jobOpening.findMany({
        where,
        include: jobOpeningInclude,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobOpening.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withAllowedActions(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string) {
    const opening = await this.prisma.jobOpening.findFirst({
      where: {
        id,
        ...this.scope.jobOpeningWhere(),
      },
      include: jobOpeningInclude,
    });

    if (!opening) {
      this.scope.notFound('Job opening');
    }

    return this.withAllowedActions(opening);
  }

  async update(id: string, dto: UpdateJobOpeningDto) {
    const opening = await this.scope.assertJobOpeningInScope(id);

    if (opening.status !== JobOpeningStatus.DRAFT) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_INVALID_TRANSITION,
        'Only draft job openings can be edited',
      );
    }

    if (dto.version !== undefined && opening.version !== dto.version) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_STALE_VERSION,
        'Job opening was modified by another request',
      );
    }

    const companyId = dto.companyId ?? opening.companyId;
    const branchId = dto.branchId ?? opening.branchId;
    const departmentId = dto.departmentId ?? opening.departmentId;
    const designationId = dto.designationId ?? opening.designationId;
    const hiringManagerEmployeeId =
      dto.hiringManagerEmployeeId ?? opening.hiringManagerEmployeeId;

    const hierarchy = await this.validateOpeningHierarchy({
      companyId,
      branchId,
      departmentId,
      designationId,
      hiringManagerEmployeeId,
    });

    if (dto.criteria) {
      this.openingTransitions.validateCriteriaTotal(dto.criteria);
    }

    const actor = getRequestActor();

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.criteria) {
        await tx.jobOpeningCriterion.deleteMany({
          where: { jobOpeningId: id },
        });
      }

      return tx.jobOpening.update({
        where: { id, version: opening.version },
        data: {
          companyGroupId: hierarchy.companyGroupId,
          companyId,
          branchId,
          departmentId,
          designationId,
          hiringManagerEmployeeId,
          title: dto.title,
          description: dto.description,
          employmentType: dto.employmentType,
          location: dto.location,
          headcountTotal: dto.headcountTotal,
          targetJoiningDate: dto.targetJoiningDate
            ? new Date(dto.targetJoiningDate)
            : undefined,
          applicationDeadline: dto.applicationDeadline
            ? new Date(dto.applicationDeadline)
            : undefined,
          version: { increment: 1 },
          updatedByUserId: actor.userId,
          criteria: dto.criteria
            ? {
                create: dto.criteria.map((criterion) =>
                  this.mapCriterionCreate(criterion),
                ),
              }
            : undefined,
        },
        include: jobOpeningInclude,
      });
    });

    return this.withAllowedActions(updated);
  }

  async remove(id: string) {
    const opening = await this.scope.assertJobOpeningInScope(id);

    if (opening.status !== JobOpeningStatus.DRAFT) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_INVALID_TRANSITION,
        'Only draft job openings can be deleted',
      );
    }

    await this.prisma.jobOpening.delete({ where: { id } });

    return { deleted: true };
  }

  publish(id: string, version?: number) {
    return this.openingTransitions.publish(id, version);
  }

  hold(id: string, version?: number) {
    return this.openingTransitions.hold(id, version);
  }

  reopen(id: string, version?: number) {
    return this.openingTransitions.reopen(id, version);
  }

  close(id: string, version?: number) {
    return this.openingTransitions.close(id, version);
  }

  getPublicationChecklist(id: string) {
    return this.openingTransitions.buildPublicationChecklist(id);
  }

  private withAllowedActions<
    T extends { status: JobOpeningStatus; version: number },
  >(opening: T) {
    return {
      ...opening,
      allowedActions: getJobOpeningAllowedActions(opening.status),
    };
  }

  private async validateOpeningHierarchy(input: {
    companyId: string;
    branchId: string;
    departmentId: string;
    designationId: string;
    hiringManagerEmployeeId: string;
  }) {
    await this.employeeScope.assertCompanyInScope(input.companyId);
    await this.employeeScope.assertBranchInScope(
      input.branchId,
      input.companyId,
    );
    await this.employeeScope.assertDepartmentInScope(
      input.departmentId,
      input.companyId,
      input.branchId,
    );
    await this.employeeScope.assertDesignationInScope(
      input.designationId,
      input.companyId,
    );

    const manager = await this.openingTransitions.assertHiringManagerValid(
      input.hiringManagerEmployeeId,
    );

    if (manager.companyId !== input.companyId) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.HIRING_MANAGER_COMPANY_MISMATCH,
        'Hiring manager must belong to the opening company.',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { companyGroupId: true },
    });

    if (!company?.companyGroupId) {
      throw new NotFoundException('Company not found');
    }

    return { companyGroupId: company.companyGroupId };
  }

  private mapCriterionCreate(criterion: JobOpeningCriterionDto) {
    return {
      name: criterion.name,
      description: criterion.description,
      weightPercent: criterion.weightPercent,
      displayOrder: criterion.displayOrder,
      isRequired: criterion.isRequired ?? true,
      isActive: criterion.isActive ?? true,
    };
  }

  private async generateOpeningCode(companyId: string) {
    const existing = await this.prisma.jobOpening.findMany({
      where: { companyId },
      select: { openingCode: true },
    });

    const maxSequence = existing.reduce((highest, opening) => {
      const match = opening.openingCode.match(/(\d+)\s*$/);
      const sequence = match ? Number(match[1]) : 0;
      return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
    }, 0);

    return `JO-${(maxSequence + 1).toString().padStart(5, '0')}`;
  }
}
