import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingRequirementValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async validateContribution(contributionId: string) {
    const contribution =
      await this.templateScope.requireContribution(contributionId);

    if (!contribution.isActive) {
      throw new BadRequestException('Contribution is inactive');
    }

    return contribution;
  }

  async ensureRequirementExists(requirementId: string) {
    return this.templateScope.requireRequirement(requirementId);
  }

  async ensureUniqueRequirementCode(
    contributionId: string,
    requirementCode?: string,
    excludeId?: string,
  ) {
    if (!requirementCode) {
      return;
    }

    const existing = await this.prisma.requirement.findFirst({
      where: {
        contributionId,
        ...this.templateScope.requirementWhere(),
        requirementCode,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Requirement code '${requirementCode}' already exists.`,
      );
    }
  }

  async ensureUniqueDisplayOrder(
    contributionId: string,
    displayOrder: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.requirement.findFirst({
      where: {
        contributionId,
        ...this.templateScope.requirementWhere(),
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

  async validateDependsOnRequirement(requirementId?: string) {
    if (!requirementId) {
      return;
    }

    return this.templateScope.requireRequirement(requirementId);
  }
}
