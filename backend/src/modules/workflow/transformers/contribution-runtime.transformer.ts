import { Injectable } from '@nestjs/common';

import { WorkflowContribution } from '../contracts';

import { RuntimeContribution } from '../runtime';

import { RequirementRuntimeTransformer } from './requirement-runtime.transformer';

import { ExecutionProfileRuntimeTransformer } from './execution-profile-runtime.transformer';

@Injectable()
export class ContributionRuntimeTransformer {
  constructor(
    private readonly requirementTransformer: RequirementRuntimeTransformer,
    private readonly executionProfileTransformer: ExecutionProfileRuntimeTransformer,
  ) {}

  transform(source: WorkflowContribution): RuntimeContribution {
    return {
      runtimeContributionId: source.id,

      runtimeContributionCode: source.contributionCode,

      contributionId: source.id,

      contributionCode: source.contributionCode,

      contributionName: source.contributionName,

      category: source.category,

      displayOrder: source.displayOrder,

      requirements: source.requirements.map((r) =>
        this.requirementTransformer.transform(r),
      ),

      executionProfiles: source.executionProfiles.map((p) =>
        this.executionProfileTransformer.transform(p),
      ),
    };
  }
}
