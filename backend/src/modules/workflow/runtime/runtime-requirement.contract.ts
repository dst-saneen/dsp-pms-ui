import { RequirementType, ReferenceType } from '@prisma/client';

export interface RuntimeRequirement {
  readonly runtimeRequirementId: string;

  readonly runtimeRequirementCode: string;

  readonly requirementId: string;

  readonly requirementType: RequirementType;

  readonly requirementName: string;

  readonly requirementValue?: string;

  readonly referenceType?: ReferenceType;

  readonly referenceId?: string;

  readonly isMandatory: boolean;

  readonly displayOrder: number;

  readonly requirementCode?: string;
}
