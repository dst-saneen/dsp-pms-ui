import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingExecutionProfileValidationService {
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

  async ensureExecutionProfileExists(profileId: string) {
    return this.templateScope.requireExecutionProfile(profileId);
  }

  async ensureUniqueProfileCode(
    contributionId: string,
    profileCode?: string,
    excludeId?: string,
  ) {
    if (!profileCode) {
      return;
    }

    const existing = await this.prisma.executionProfile.findFirst({
      where: {
        contributionId,
        ...this.templateScope.executionProfileWhere(),
        profileCode,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Profile code '${profileCode}' already exists.`,
      );
    }
  }

  async ensureUniqueDisplayOrder(
    contributionId: string,
    displayOrder: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.executionProfile.findFirst({
      where: {
        contributionId,
        ...this.templateScope.executionProfileWhere(),
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
