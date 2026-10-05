import { Injectable } from '@nestjs/common';

import { WorkflowDepartment } from '../contracts';

import { RuntimeDepartment } from '../runtime';

import { ContributionRuntimeTransformer } from './contribution-runtime.transformer';

@Injectable()
export class DepartmentRuntimeTransformer {
  constructor(
    private readonly contributionTransformer: ContributionRuntimeTransformer,
  ) {}

  transform(source: WorkflowDepartment): RuntimeDepartment {
    return {
      runtimeDepartmentId: source.id,

      runtimeDepartmentCode: source.departmentCode ?? source.id,

      departmentTemplateId: source.id,

      departmentId: source.departmentId,

      departmentCode: source.departmentCode,

      departmentName: source.departmentName,

      displayOrder: source.displayOrder,

      contributions: source.contributions.map((c) =>
        this.contributionTransformer.transform(c),
      ),
    };
  }
}
