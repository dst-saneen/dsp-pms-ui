import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

import {
  CreateOnboardingTaskGroupDto,
  UpdateOnboardingTaskGroupDto,
} from '../dto';

import { OnboardingTaskGroupValidationService } from './onboarding-task-group-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingTaskGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: OnboardingTaskGroupValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateOnboardingTaskGroupDto) {
    const slice = await this.templateScope.requireDepartmentTemplate(
      dto.onboardingDepartmentTemplateId,
    );
    await this.templateScope.requireMutableVersion(
      slice.onboardingTemplateVersionId,
    );

    const companyId =
      slice.companyId ??
      this.templateScope.resolveVersionCompanyId(slice.version);

    await this.validation.ensureUniqueGroupName(
      dto.onboardingDepartmentTemplateId,
      dto.groupName,
    );

    await this.validation.ensureUniqueDisplayOrder(
      dto.onboardingDepartmentTemplateId,
      dto.displayOrder,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(
        tx,
        slice.onboardingTemplateVersionId,
      );
      return tx.onboardingTaskGroup.create({
        data: {
          onboardingDepartmentTemplateId: dto.onboardingDepartmentTemplateId,
          companyId,
          onboardingTemplateVersionId: slice.onboardingTemplateVersionId,
          groupCode: dto.groupCode,
          groupName: dto.groupName,
          description: dto.description,
          displayOrder: dto.displayOrder,
          isMandatory: dto.isMandatory,
          rowVersion: 1,
        },
      });
    });
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.onboardingTaskGroup.findMany({
      where: this.templateScope.taskGroupWhere(),
      include: {
        tasks: {
          orderBy: {
            sequenceNo: 'asc',
          },
        },
      },
      orderBy: [
        {
          onboardingDepartmentTemplateId: 'asc',
        },
        {
          displayOrder: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    return this.templateScope.requireTaskGroup(id);
  }

  async findByDepartmentTemplate(departmentTemplateId: string) {
    await this.templateScope.requireDepartmentTemplate(departmentTemplateId);

    return this.prisma.onboardingTaskGroup.findMany({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,
        ...this.templateScope.taskGroupWhere(),
      },
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
    });
  }

  async update(id: string, dto: UpdateOnboardingTaskGroupDto) {
    const existing = await this.templateScope.requireTaskGroup(id);
    await this.templateScope.requireMutableVersion(
      existing.departmentTemplate.onboardingTemplateVersionId,
    );
    this.templateScope.assertRowVersion(
      dto.expectedVersion,
      dto.expectedVersion,
    );

    if (dto.groupName && dto.groupName !== existing.groupName) {
      await this.validation.ensureUniqueGroupName(
        existing.onboardingDepartmentTemplateId,
        dto.groupName,
        id,
      );
    }

    if (
      dto.displayOrder !== undefined &&
      dto.displayOrder !== existing.displayOrder
    ) {
      await this.validation.ensureUniqueDisplayOrder(
        existing.onboardingDepartmentTemplateId,
        dto.displayOrder,
        id,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(
        tx,
        existing.departmentTemplate.onboardingTemplateVersionId,
      );
      const result = await tx.onboardingTaskGroup.updateMany({
        where: { id },
        data: {
          groupCode: dto.groupCode,
          groupName: dto.groupName,
          description: dto.description,
          displayOrder: dto.displayOrder,
          isMandatory: dto.isMandatory,
        },
      });
      this.templateScope.assertMutationApplied(result.count);
    });

    return this.templateScope.requireTaskGroup(id);
  }

  async remove(id: string, expectedVersion: number) {
    const existing = await this.templateScope.requireTaskGroup(id);
    await this.templateScope.requireMutableVersion(
      existing.departmentTemplate.onboardingTemplateVersionId,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(
        tx,
        existing.departmentTemplate.onboardingTemplateVersionId,
      );
      void expectedVersion;

      await tx.onboardingTemplateTask.deleteMany({
        where: { taskGroupId: id },
      });
      const result = await tx.onboardingTaskGroup.deleteMany({
        where: { id },
      });
      this.templateScope.assertMutationApplied(result.count);
      return existing;
    });
  }
}
