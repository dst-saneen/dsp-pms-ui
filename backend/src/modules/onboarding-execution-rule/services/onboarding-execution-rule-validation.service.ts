import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingExecutionRuleValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async validateExecutionProfile(executionProfileId: string) {
    return this.templateScope.requireExecutionProfile(executionProfileId);
  }

  async ensureExecutionRuleExists(ruleId: string) {
    return this.templateScope.requireExecutionRule(ruleId);
  }

  async ensureUniqueSequence(
    executionProfileId: string,
    sequenceNo: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.executionRule.findFirst({
      where: {
        executionProfileId,
        ...this.templateScope.executionRuleWhere(),
        sequenceNo,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(`Sequence ${sequenceNo} already exists.`);
    }
  }

  async validateApprovalWorkflow(
    approvalWorkflowId: string | null | undefined,
    companyId: string,
  ) {
    if (!approvalWorkflowId) {
      return;
    }

    return this.templateScope.requireApprovalWorkflow(
      approvalWorkflowId,
      companyId,
    );
  }
}
