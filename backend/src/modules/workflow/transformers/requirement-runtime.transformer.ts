import { Injectable } from '@nestjs/common';

import { WorkflowRequirement } from '../contracts';

import { RuntimeRequirement } from '../runtime';

@Injectable()
export class RequirementRuntimeTransformer {
  transform(source: WorkflowRequirement): RuntimeRequirement {
    return {
      runtimeRequirementId: source.id,

      runtimeRequirementCode: source.requirementCode ?? source.id,

      requirementId: source.id,

      requirementCode: source.requirementCode,

      requirementType: source.requirementType,

      requirementName: source.requirementName,

      requirementValue: source.requirementValue,

      referenceType: source.referenceType,

      referenceId: source.referenceId,

      isMandatory: source.isMandatory,

      displayOrder: source.displayOrder,
    };
  }
}
