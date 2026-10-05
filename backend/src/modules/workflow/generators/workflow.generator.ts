import { Injectable } from '@nestjs/common';

import { WorkflowIdUtils } from '../utils/workflow-id.utils';

@Injectable()
export class WorkflowGenerator {
  generateWorkflowId(): string {
    return WorkflowIdUtils.workflowId();
  }

  generateWorkflowCode(): string {
    return WorkflowIdUtils.workflowCode();
  }

  generateDepartmentId(): string {
    return WorkflowIdUtils.departmentId();
  }

  generateDepartmentCode(workflowCode: string, displayOrder: number): string {
    return WorkflowIdUtils.departmentCode(workflowCode, displayOrder);
  }

  generateContributionId(): string {
    return WorkflowIdUtils.contributionId();
  }

  generateContributionCode(
    departmentCode: string,
    displayOrder: number,
  ): string {
    return WorkflowIdUtils.contributionCode(departmentCode, displayOrder);
  }

  generateRequirementId(): string {
    return WorkflowIdUtils.requirementId();
  }

  generateRequirementCode(
    contributionCode: string,
    displayOrder: number,
  ): string {
    return WorkflowIdUtils.requirementCode(contributionCode, displayOrder);
  }

  generateExecutionProfileId(): string {
    return WorkflowIdUtils.executionProfileId();
  }

  generateExecutionProfileCode(
    contributionCode: string,
    displayOrder: number,
  ): string {
    return WorkflowIdUtils.executionProfileCode(contributionCode, displayOrder);
  }

  generateExecutionRuleId(): string {
    return WorkflowIdUtils.executionRuleId();
  }

  generateExecutionRuleCode(profileCode: string, sequenceNo: number): string {
    return WorkflowIdUtils.executionRuleCode(profileCode, sequenceNo);
  }
}
