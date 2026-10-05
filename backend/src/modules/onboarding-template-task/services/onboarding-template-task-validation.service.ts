import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingTemplateTaskValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async ensureTaskExists(id: string) {
    try {
      return await this.templateScope.requireTask(id);
    } catch {
      throw new NotFoundException('Task not found.');
    }
  }
}
