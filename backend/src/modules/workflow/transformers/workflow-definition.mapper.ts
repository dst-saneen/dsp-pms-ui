import { Injectable } from '@nestjs/common';

import { WorkflowDefinitionSource } from '../builders/workflow-definition-source.contract';

import { WorkflowContribution } from '../contracts/workflow-contribution.contract';
import { WorkflowDefinition } from '../contracts/workflow-definition.contract';
import { WorkflowDepartment } from '../contracts/workflow-department.contract';
import { WorkflowExecutionProfile } from '../contracts/workflow-execution-profile.contract';
import { WorkflowExecutionRule } from '../contracts/workflow-execution-rule.contract';
import { WorkflowRequirement } from '../contracts/workflow-requirement.contract';

@Injectable()
export class WorkflowDefinitionMapper {
  map(source: WorkflowDefinitionSource): WorkflowDefinition {
    const requirementsByContribution = new Map<string, WorkflowRequirement[]>();

    for (const requirement of source.requirements) {
      const list =
        requirementsByContribution.get(requirement.contributionId) ?? [];

      list.push({
        id: requirement.id,
        requirementType: requirement.requirementType,
        requirementCode: requirement.requirementCode ?? undefined,
        requirementName: requirement.requirementName,
        requirementValue: requirement.requirementValue ?? undefined,
        description: requirement.description ?? undefined,
        referenceType: requirement.referenceType ?? undefined,
        referenceId: requirement.referenceId ?? undefined,
        dependsOnRequirementId: requirement.dependsOnRequirementId ?? undefined,
        validationRule: requirement.validationRule ?? undefined,
        isMandatory: requirement.isMandatory,
        displayOrder: requirement.displayOrder,
      });

      requirementsByContribution.set(requirement.contributionId, list);
    }

    const executionRulesByProfile = new Map<string, WorkflowExecutionRule[]>();

    for (const rule of source.executionRules) {
      const list = executionRulesByProfile.get(rule.executionProfileId) ?? [];

      list.push({
        id: rule.id,
        sequenceNo: rule.sequenceNo,
        ownerType: rule.ownerType,
        executionType: rule.executionType,
        action: rule.action,
        workType: rule.workType,
        approvalWorkflowId: rule.approvalWorkflowId ?? undefined,
        dueDays: rule.dueDays ?? undefined,
        reminderIntervalDays: rule.reminderIntervalDays ?? undefined,
        estimatedDurationMinutes: rule.estimatedDurationMinutes ?? undefined,
        conditionExpression: rule.conditionExpression ?? undefined,
        autoComplete: rule.autoComplete,
        allowReopen: rule.allowReopen,
        isActive: rule.isActive,
      });

      executionRulesByProfile.set(rule.executionProfileId, list);
    }

    const executionProfilesByContribution = new Map<
      string,
      WorkflowExecutionProfile[]
    >();

    for (const profile of source.executionProfiles) {
      const list =
        executionProfilesByContribution.get(profile.contributionId) ?? [];

      list.push({
        id: profile.id,
        profileCode: profile.profileCode ?? undefined,
        profileName: profile.profileName,
        description: profile.description ?? undefined,
        displayOrder: profile.displayOrder,
        isDefault: profile.isDefault,
        rules: (executionRulesByProfile.get(profile.id) ?? []).sort(
          (a, b) => a.sequenceNo - b.sequenceNo,
        ),
      });

      executionProfilesByContribution.set(profile.contributionId, list);
    }

    const contributionsByDepartment = new Map<string, WorkflowContribution[]>();

    for (const contribution of source.contributions) {
      const list =
        contributionsByDepartment.get(
          contribution.onboardingDepartmentTemplateId,
        ) ?? [];

      list.push({
        id: contribution.id,
        contributionCode: contribution.contributionCode,
        contributionName: contribution.contributionName,
        description: contribution.description ?? undefined,
        category: contribution.category,
        businessCapabilityId: contribution.businessCapabilityId ?? undefined,
        businessCapabilityCode:
          contribution.businessCapabilityCode ?? undefined,
        displayOrder: contribution.displayOrder,
        isRequired: contribution.isRequired,
        requirements: (
          requirementsByContribution.get(contribution.id) ?? []
        ).sort((a, b) => a.displayOrder - b.displayOrder),
        executionProfiles: (
          executionProfilesByContribution.get(contribution.id) ?? []
        ).sort((a, b) => a.displayOrder - b.displayOrder),
      });

      contributionsByDepartment.set(
        contribution.onboardingDepartmentTemplateId,
        list,
      );
    }

    const departments: WorkflowDepartment[] = source.departments
      .map((department) => ({
        id: department.id,
        departmentId: department.departmentId,
        departmentCode: department.department.departmentCode ?? undefined,
        departmentName: department.department.departmentName,
        displayOrder: department.displayOrder,
        isRequired: department.isRequired,
        approvalWorkflowId: department.approvalWorkflowId ?? undefined,
        contributions: (
          contributionsByDepartment.get(department.id) ?? []
        ).sort((a, b) => a.displayOrder - b.displayOrder),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      template: {
        id: source.template.id,
        templateCode: source.template.templateCode ?? undefined,
        templateName: source.template.templateName,
        description: source.template.description ?? undefined,
        lifecycle: source.template.lifecycle,
        isDefault: source.template.isDefault,
      },

      version: {
        id: source.version.id,
        versionNo: source.version.versionNo,
        versionName: source.version.versionName ?? undefined,
        status: source.version.status,
        isCurrent: source.version.isCurrent,
        effectiveFrom: source.version.effectiveFrom ?? undefined,
      },

      departments,
    };
  }
}
