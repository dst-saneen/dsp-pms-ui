import { ContributionCategory } from '@prisma/client';

import { WorkflowRequirement } from './workflow-requirement.contract';
import { WorkflowExecutionProfile } from './workflow-execution-profile.contract';

export interface WorkflowContribution {
  readonly id: string;

  readonly contributionCode: string;

  readonly contributionName: string;

  readonly description?: string;

  readonly category: ContributionCategory;

  readonly businessCapabilityId?: string;

  readonly businessCapabilityCode?: string;

  readonly displayOrder: number;

  readonly isRequired: boolean;

  readonly requirements: readonly WorkflowRequirement[];

  readonly executionProfiles: readonly WorkflowExecutionProfile[];
}
