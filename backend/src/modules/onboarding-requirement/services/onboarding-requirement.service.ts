import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

import { CreateRequirementDto } from '../dto/create-requirement.dto';
import { UpdateRequirementDto } from '../dto/update-requirement.dto';

import { OnboardingRequirementValidationService } from './onboarding-requirement-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly validation: OnboardingRequirementValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateRequirementDto) {
    await this.validation.validateContribution(dto.contributionId);

    await this.validation.ensureUniqueRequirementCode(
      dto.contributionId,
      dto.requirementCode,
    );

    await this.validation.ensureUniqueDisplayOrder(
      dto.contributionId,
      dto.displayOrder ?? 0,
    );

    await this.validation.validateDependsOnRequirement(
      dto.dependsOnRequirementId,
    );

    const requirement = await this.prisma.requirement.create({
      data: {
        contributionId: dto.contributionId,

        requirementType: dto.requirementType,

        requirementCode: dto.requirementCode,

        requirementName: dto.requirementName,

        requirementValue: dto.requirementValue,

        description: dto.description,

        referenceType: dto.referenceType,

        referenceId: dto.referenceId,

        dependsOnRequirementId: dto.dependsOnRequirementId,

        defaultValue: dto.defaultValue,

        validationRule: dto.validationRule,

        isMandatory: dto.isMandatory ?? true,

        displayOrder: dto.displayOrder ?? 0,
      },

      include: {
        contribution: {
          include: {
            departmentTemplate: {
              include: {
                department: true,
                version: {
                  include: {
                    onboardingTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await this.auditService.log(
      'Requirement',
      requirement.id,
      'CREATE',
      null,
      requirement,
    );

    return requirement;
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.requirement.findMany({
      where: this.templateScope.requirementWhere(),
      include: {
        contribution: {
          include: {
            departmentTemplate: {
              include: {
                department: true,
                version: {
                  include: {
                    onboardingTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          requirementName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    await this.validation.ensureRequirementExists(id);

    return this.prisma.requirement.findFirst({
      where: {
        id,
        ...this.templateScope.requirementWhere(),
      },
      include: {
        contribution: {
          include: {
            departmentTemplate: {
              include: {
                department: true,
                version: {
                  include: {
                    onboardingTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findByContribution(contributionId: string) {
    await this.validation.validateContribution(contributionId);

    return this.prisma.requirement.findMany({
      where: {
        contributionId,
        ...this.templateScope.requirementWhere(),
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async update(id: string, dto: UpdateRequirementDto) {
    const existing = await this.validation.ensureRequirementExists(id);

    const contributionId = dto.contributionId ?? existing.contributionId;

    const targetContribution =
      await this.validation.validateContribution(contributionId);

    if (
      this.templateScope.resolveDepartmentTemplateCompanyId(
        existing.contribution.departmentTemplate,
      ) !==
      this.templateScope.resolveDepartmentTemplateCompanyId(
        targetContribution.departmentTemplate,
      )
    ) {
      throw new ConflictException(
        'A requirement cannot be moved to a different Company.',
      );
    }

    await this.validation.ensureUniqueRequirementCode(
      contributionId,
      dto.requirementCode,
      id,
    );

    if (dto.displayOrder !== undefined) {
      await this.validation.ensureUniqueDisplayOrder(
        contributionId,
        dto.displayOrder,
        id,
      );
    }

    await this.validation.validateDependsOnRequirement(
      dto.dependsOnRequirementId,
    );

    const updated = await this.prisma.requirement.update({
      where: {
        id,
      },
      data: {
        contributionId: dto.contributionId,

        requirementType: dto.requirementType,

        requirementCode: dto.requirementCode,

        requirementName: dto.requirementName,

        requirementValue: dto.requirementValue,

        description: dto.description,

        referenceType: dto.referenceType,

        referenceId: dto.referenceId,

        dependsOnRequirementId: dto.dependsOnRequirementId,

        defaultValue: dto.defaultValue,

        validationRule: dto.validationRule,

        isMandatory: dto.isMandatory,

        displayOrder: dto.displayOrder,
      },

      include: {
        contribution: {
          include: {
            departmentTemplate: {
              include: {
                department: true,
                version: {
                  include: {
                    onboardingTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await this.auditService.log(
      'Requirement',
      updated.id,
      'UPDATE',
      existing,
      updated,
    );

    return updated;
  }

  async remove(id: string) {
    const existing = await this.validation.ensureRequirementExists(id);

    await this.prisma.requirement.delete({
      where: {
        id,
      },
    });

    await this.auditService.log('Requirement', id, 'DELETE', existing, null);

    return {
      message: 'Requirement deleted successfully.',
    };
  }
}
