import { ConflictException, Injectable } from '@nestjs/common';

import { DomainNotFoundException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../../onboarding-template/constants';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class TaskContributionValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async ensureTaskExists(id: string) {
    return this.templateScope.requireTask(id);
  }

  async ensureContributionExists(id: string) {
    return this.templateScope.requireContribution(id);
  }

  async ensureTaskContributionExists(id: string) {
    const taskContribution = await this.prisma.taskContribution.findFirst({
      where: {
        id,
        task: this.templateScope.taskWhere(),
        contribution: this.templateScope.contributionWhere(),
      },
    });

    if (!taskContribution) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_CONTRIBUTION_NOT_FOUND,
        'Task contribution not found.',
      );
    }

    return taskContribution;
  }

  async ensureUniqueTaskContribution(
    taskId: string,
    contributionId: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.taskContribution.findFirst({
      where: {
        taskId,
        contributionId,

        ...(excludeId
          ? {
              NOT: {
                id: excludeId,
              },
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Contribution already attached to task.');
    }
  }
}
