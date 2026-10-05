import { ContributionCategory } from '@prisma/client';

import { RuntimeExecutionProfile } from './runtime-execution-profile.contract';
import { RuntimeRequirement } from './runtime-requirement.contract';

export interface RuntimeContribution {
  readonly runtimeContributionId: string;

  readonly runtimeContributionCode: string;

  readonly contributionId: string;

  readonly contributionCode: string;

  readonly contributionName: string;

  readonly category: ContributionCategory;

  readonly displayOrder: number;

  readonly requirements: readonly RuntimeRequirement[];

  readonly executionProfiles: readonly RuntimeExecutionProfile[];
}
