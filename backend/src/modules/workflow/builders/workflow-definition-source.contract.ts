import {
  Contribution,
  ExecutionProfile,
  ExecutionRule,
  OnboardingTemplateVersion,
  Prisma,
  Requirement,
} from '@prisma/client';

export interface WorkflowDefinitionSource {
  readonly version: OnboardingTemplateVersion;

  readonly template: {
    id: string;
    templateCode?: string | null;
    templateName: string;
    description?: string | null;
    lifecycle: string;
    isDefault: boolean;
  };

  readonly departments: readonly Prisma.OnboardingDepartmentTemplateGetPayload<{
    include: {
      department: true;
      approvalWorkflow: true;
    };
  }>[];

  readonly contributions: readonly Contribution[];

  readonly requirements: readonly Requirement[];

  readonly executionProfiles: readonly ExecutionProfile[];

  readonly executionRules: readonly ExecutionRule[];
}
