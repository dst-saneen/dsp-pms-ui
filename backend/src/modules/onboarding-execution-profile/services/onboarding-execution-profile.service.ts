import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

import { CreateExecutionProfileDto } from '../dto/create-execution-profile.dto';
import { UpdateExecutionProfileDto } from '../dto/update-execution-profile.dto';

import { OnboardingExecutionProfileValidationService } from './onboarding-execution-profile-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingExecutionProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly validation: OnboardingExecutionProfileValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateExecutionProfileDto) {
    await this.validation.validateContribution(dto.contributionId);

    await this.validation.ensureUniqueProfileCode(
      dto.contributionId,
      dto.profileCode,
    );

    await this.validation.ensureUniqueDisplayOrder(
      dto.contributionId,
      dto.displayOrder ?? 0,
    );

    const profile = await this.prisma.executionProfile.create({
      data: {
        contributionId: dto.contributionId,

        profileCode: dto.profileCode,

        profileName: dto.profileName,

        description: dto.description,

        displayOrder: dto.displayOrder ?? 0,

        isDefault: dto.isDefault ?? true,
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
      'ExecutionProfile',
      profile.id,
      'CREATE',
      null,
      profile,
    );

    return profile;
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.executionProfile.findMany({
      where: this.templateScope.executionProfileWhere(),
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
          profileName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    await this.validation.ensureExecutionProfileExists(id);

    return this.prisma.executionProfile.findFirst({
      where: {
        id,
        ...this.templateScope.executionProfileWhere(),
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

    return this.prisma.executionProfile.findMany({
      where: {
        contributionId,
        ...this.templateScope.executionProfileWhere(),
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async update(id: string, dto: UpdateExecutionProfileDto) {
    const existing = await this.validation.ensureExecutionProfileExists(id);

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
        'An execution profile cannot be moved to a different Company.',
      );
    }

    await this.validation.ensureUniqueProfileCode(
      contributionId,
      dto.profileCode,
      id,
    );

    if (dto.displayOrder !== undefined) {
      await this.validation.ensureUniqueDisplayOrder(
        contributionId,
        dto.displayOrder,
        id,
      );
    }

    const updated = await this.prisma.executionProfile.update({
      where: {
        id,
      },
      data: {
        contributionId: dto.contributionId,

        profileCode: dto.profileCode,

        profileName: dto.profileName,

        description: dto.description,

        displayOrder: dto.displayOrder,

        isDefault: dto.isDefault,
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
      'ExecutionProfile',
      updated.id,
      'UPDATE',
      existing,
      updated,
    );

    return updated;
  }

  async remove(id: string) {
    const existing = await this.validation.ensureExecutionProfileExists(id);

    await this.prisma.executionProfile.delete({
      where: {
        id,
      },
    });

    await this.auditService.log(
      'ExecutionProfile',
      id,
      'DELETE',
      existing,
      null,
    );

    return {
      message: 'Execution Profile deleted successfully.',
    };
  }
}
