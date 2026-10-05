import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

import { AuditService } from '../../audit/audit.service';

import { CreateContributionDto } from '../dto/create-contribution.dto';
import { UpdateContributionDto } from '../dto/update-contribution.dto';

import { OnboardingContributionValidationService } from './onboarding-contribution-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingContributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly validation: OnboardingContributionValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateContributionDto) {
    // Validate Department Template

    await this.validation.validateDepartmentTemplate(
      dto.onboardingDepartmentTemplateId,
    );

    // Validate Contribution Code

    await this.validation.ensureUniqueContributionCode(
      dto.onboardingDepartmentTemplateId,
      dto.contributionCode,
    );

    // Validate Display Order

    await this.validation.ensureUniqueDisplayOrder(
      dto.onboardingDepartmentTemplateId,
      dto.displayOrder ?? 0,
    );

    // Create Contribution

    const contribution = await this.prisma.contribution.create({
      data: {
        onboardingDepartmentTemplateId: dto.onboardingDepartmentTemplateId,

        contributionCode: dto.contributionCode,

        contributionName: dto.contributionName,

        description: dto.description,

        category: dto.category,

        businessCapabilityId: dto.businessCapabilityId,

        businessCapabilityCode: dto.businessCapabilityCode,

        displayOrder: dto.displayOrder ?? 0,

        isRequired: dto.isRequired ?? true,

        isActive: dto.isActive ?? true,
      },

      include: {
        departmentTemplate: {
          include: {
            department: true,
            version: true,
          },
        },

        requirements: true,

        executionProfiles: true,
      },
    });

    await this.auditService.log(
      'Contribution',
      contribution.id,
      'CREATE',
      null,
      contribution,
    );

    return contribution;
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.contribution.findMany({
      where: {
        isActive: true,
        ...this.templateScope.contributionWhere(),
      },
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
        requirements: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        executionProfiles: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          contributionName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    await this.validation.ensureContributionExists(id);

    return this.prisma.contribution.findFirst({
      where: {
        id,
        ...this.templateScope.contributionWhere(),
      },
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
        requirements: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        executionProfiles: {
          include: {
            rules: {
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
    });
  }

  async findByDepartmentTemplate(departmentTemplateId: string) {
    await this.validation.validateDepartmentTemplate(departmentTemplateId);

    return this.prisma.contribution.findMany({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,
        isActive: true,
        ...this.templateScope.contributionWhere(),
      },
      include: {
        requirements: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        executionProfiles: {
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

  async update(id: string, dto: UpdateContributionDto) {
    const existing = await this.validation.ensureContributionExists(id);

    const departmentTemplateId =
      dto.onboardingDepartmentTemplateId ??
      existing.onboardingDepartmentTemplateId;

    const targetDepartmentTemplate =
      await this.validation.validateDepartmentTemplate(departmentTemplateId);

    if (
      this.templateScope.resolveDepartmentTemplateCompanyId(
        existing.departmentTemplate,
      ) !==
      this.templateScope.resolveDepartmentTemplateCompanyId(
        targetDepartmentTemplate,
      )
    ) {
      throw new ConflictException(
        'A contribution cannot be moved to a different Company.',
      );
    }

    if (dto.contributionCode) {
      await this.validation.ensureUniqueContributionCode(
        departmentTemplateId,
        dto.contributionCode,
        id,
      );
    }

    if (dto.displayOrder !== undefined) {
      await this.validation.ensureUniqueDisplayOrder(
        departmentTemplateId,
        dto.displayOrder,
        id,
      );
    }

    const updated = await this.prisma.contribution.update({
      where: {
        id,
      },
      data: {
        onboardingDepartmentTemplateId: dto.onboardingDepartmentTemplateId,

        contributionCode: dto.contributionCode,

        contributionName: dto.contributionName,

        description: dto.description,

        category: dto.category,

        businessCapabilityId: dto.businessCapabilityId,

        businessCapabilityCode: dto.businessCapabilityCode,

        displayOrder: dto.displayOrder,

        isRequired: dto.isRequired,

        isActive: dto.isActive,
      },
      include: {
        departmentTemplate: {
          include: {
            department: true,
            version: true,
          },
        },
        requirements: true,
        executionProfiles: true,
      },
    });

    await this.auditService.log(
      'Contribution',
      updated.id,
      'UPDATE',
      existing,
      updated,
    );

    return updated;
  }

  async remove(id: string) {
    const existing = await this.validation.ensureContributionExists(id);

    const deleted = await this.prisma.contribution.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    await this.auditService.log(
      'Contribution',
      id,
      'DELETE',
      existing,
      deleted,
    );

    return deleted;
  }
}
