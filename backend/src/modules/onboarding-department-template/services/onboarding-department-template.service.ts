import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateOnboardingDepartmentTemplateDto,
  UpdateOnboardingDepartmentTemplateDto,
} from '../dto';
import { OnboardingDepartmentTemplateValidationService } from './onboarding-department-template-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';
import { DomainConflictException } from '../../../common';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../../onboarding-template/constants';

const SLICE_INCLUDE = {
  version: true,
  department: true,
} as const;

@Injectable()
export class OnboardingDepartmentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: OnboardingDepartmentTemplateValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async findOne(id: string) {
    return this.templateScope.requireDepartmentTemplate(id);
  }

  async findByTemplateVersionId(templateVersionId: string) {
    await this.templateScope.requireVersion(templateVersionId);

    return this.prisma.onboardingDepartmentTemplate.findMany({
      where: {
        onboardingTemplateVersionId: templateVersionId,
        ...this.templateScope.departmentTemplateWhere(),
      },
      include: {
        department: true,
        taskGroups: {
          include: {
            tasks: {
              orderBy: {
                sequenceNo: 'asc',
              },
            },
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async create(dto: CreateOnboardingDepartmentTemplateDto) {
    const version = await this.templateScope.requireMutableVersion(
      dto.onboardingTemplateVersionId,
    );
    const companyId = this.templateScope.resolveVersionCompanyId(version);

    const existingSlices =
      await this.prisma.onboardingDepartmentTemplate.findMany({
        where: {
          onboardingTemplateVersionId: version.id,
          ...this.templateScope.departmentTemplateWhere(),
        },
        include: {
          department: {
            select: {
              branchId: true,
            },
          },
        },
      });

    const requiredBranchId = existingSlices[0]?.department.branchId;

    const department = requiredBranchId
      ? await this.templateScope.requireDepartmentInCompanyBranch({
          companyId,
          branchId: requiredBranchId,
          departmentId: dto.departmentId,
        })
      : await this.templateScope.requireDepartmentInCompany({
          companyId,
          departmentId: dto.departmentId,
        });

    if (requiredBranchId && department.branchId !== requiredBranchId) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_BRANCH_MISMATCH,
        'Department work in a template version must belong to one Branch.',
      );
    }

    await this.validation.ensureUniqueDepartment(
      dto.onboardingTemplateVersionId,
      dto.departmentId,
    );

    await this.validation.ensureUniqueDisplayOrder(
      dto.onboardingTemplateVersionId,
      dto.displayOrder,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);
      return tx.onboardingDepartmentTemplate.create({
        data: {
          onboardingTemplateVersionId: dto.onboardingTemplateVersionId,
          departmentId: dto.departmentId,
          companyId,
          branchId: department.branchId,
          displayOrder: dto.displayOrder,
          isRequired: dto.isRequired,
          isActive: true,
          rowVersion: 1,
        },
        include: SLICE_INCLUDE,
      });
    });
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.onboardingDepartmentTemplate.findMany({
      where: this.templateScope.departmentTemplateWhere(),
      include: SLICE_INCLUDE,
      orderBy: [
        {
          onboardingTemplateVersionId: 'asc',
        },
        {
          displayOrder: 'asc',
        },
      ],
    });
  }

  async update(id: string, dto: UpdateOnboardingDepartmentTemplateDto) {
    const existing = await this.templateScope.requireDepartmentTemplate(id);
    await this.templateScope.requireMutableVersion(
      existing.onboardingTemplateVersionId,
    );
    void dto.expectedVersion;

    if (
      dto.displayOrder !== undefined &&
      dto.displayOrder !== existing.displayOrder
    ) {
      await this.validation.ensureUniqueDisplayOrder(
        existing.onboardingTemplateVersionId,
        dto.displayOrder,
        id,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(
        tx,
        existing.onboardingTemplateVersionId,
      );
      const result = await tx.onboardingDepartmentTemplate.updateMany({
        where: { id },
        data: {
          displayOrder: dto.displayOrder,
          isRequired: dto.isRequired,
        },
      });
      this.templateScope.assertMutationApplied(result.count);
    });

    return this.templateScope.requireDepartmentTemplate(id);
  }

  async remove(id: string, expectedVersion: number) {
    const existing = await this.templateScope.requireDepartmentTemplate(id);
    await this.templateScope.requireMutableVersion(
      existing.onboardingTemplateVersionId,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(
        tx,
        existing.onboardingTemplateVersionId,
      );
      void expectedVersion;

      const groups = await tx.onboardingTaskGroup.findMany({
        where: { onboardingDepartmentTemplateId: id },
        select: { id: true },
      });
      const groupIds = groups.map((group) => group.id);
      if (groupIds.length > 0) {
        await tx.onboardingTemplateTask.deleteMany({
          where: { taskGroupId: { in: groupIds } },
        });
        await tx.onboardingTaskGroup.deleteMany({
          where: { id: { in: groupIds } },
        });
      }
      const result = await tx.onboardingDepartmentTemplate.deleteMany({
        where: { id },
      });
      this.templateScope.assertMutationApplied(result.count);
      return existing;
    });
  }
}
