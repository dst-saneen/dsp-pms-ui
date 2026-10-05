import { RequirementType, ReferenceType } from '@prisma/client';

export interface WorkflowRequirement {
  readonly id: string;

  readonly requirementType: RequirementType;

  readonly requirementCode?: string;

  readonly requirementName: string;

  readonly requirementValue?: string;

  readonly description?: string;

  readonly referenceType?: ReferenceType;

  readonly referenceId?: string;

  readonly dependsOnRequirementId?: string;

  readonly validationRule?: string;

  readonly isMandatory: boolean;

  readonly displayOrder: number;
}
