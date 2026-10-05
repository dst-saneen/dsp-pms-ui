import { Injectable } from '@nestjs/common';

import { RuntimeWorkflow } from '../runtime';

import { WorkflowDefinition } from '../contracts';

import { DepartmentRuntimeTransformer } from '../transformers';

@Injectable()
export class RuntimeWorkflowBuilder {
  constructor(
    private readonly departmentTransformer: DepartmentRuntimeTransformer,
  ) {}

  build(definition: WorkflowDefinition): RuntimeWorkflow {
    return {
      workflowId: definition.version.id,

      workflowCode: definition.template.templateCode ?? definition.template.id,

      templateId: definition.template.id,

      templateVersionId: definition.version.id,

      departments: definition.departments.map((department) =>
        this.departmentTransformer.transform(department),
      ),
    };
  }
}
