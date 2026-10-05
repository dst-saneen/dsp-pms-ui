import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingContributionValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async validateDepartmentTemplate(departmentTemplateId: string) {
    const departmentTemplate =
      await this.templateScope.requireDepartmentTemplate(departmentTemplateId);

    if (!departmentTemplate.isActive) {
      throw new BadRequestException('Department Template is inactive');
    }

    return departmentTemplate;
  }

  async ensureContributionExists(contributionId: string) {
    return this.templateScope.requireContribution(contributionId);
  }

  async ensureUniqueContributionCode(
    departmentTemplateId: string,
    contributionCode: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.contribution.findFirst({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,
        ...this.templateScope.contributionWhere(),

        contributionCode,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Contribution code '${contributionCode}' already exists.`,
      );
    }
  }

  async ensureUniqueDisplayOrder(
    departmentTemplateId: string,
    displayOrder: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.contribution.findFirst({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,
        ...this.templateScope.contributionWhere(),

        displayOrder,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Display Order ${displayOrder} already exists.`,
      );
    }
  }
}
