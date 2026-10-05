import { Injectable } from '@nestjs/common';

import { ContributionReader } from '../readers/contribution.reader';
import { DepartmentTemplateReader } from '../readers/department-template.reader';
import { ExecutionProfileReader } from '../readers/execution-profile.reader';
import { ExecutionRuleReader } from '../readers/execution-rule.reader';
import { RequirementReader } from '../readers/requirement.reader';
import { TemplateVersionReader } from '../readers/template-version.reader';

import { WorkflowDefinitionMapper } from '../transformers/workflow-definition.mapper';
import { WorkflowDefinitionSource } from './workflow-definition-source.contract';

import { WorkflowDefinition } from '../contracts/workflow-definition.contract';

@Injectable()
export class WorkflowDefinitionBuilder {
  constructor(
    private readonly templateVersionReader: TemplateVersionReader,
    private readonly departmentTemplateReader: DepartmentTemplateReader,
    private readonly contributionReader: ContributionReader,
    private readonly requirementReader: RequirementReader,
    private readonly executionProfileReader: ExecutionProfileReader,
    private readonly executionRuleReader: ExecutionRuleReader,
    private readonly mapper: WorkflowDefinitionMapper,
  ) {}

  async build(templateVersionId: string): Promise<WorkflowDefinition> {
    const version =
      await this.templateVersionReader.findById(templateVersionId);

    const departments =
      await this.departmentTemplateReader.findByTemplateVersion(
        templateVersionId,
      );

    const departmentTemplateIds = departments.map(
      (department) => department.id,
    );

    const contributions =
      await this.contributionReader.findByDepartmentTemplateIds(
        departmentTemplateIds,
      );

    const contributionIds = contributions.map(
      (contribution) => contribution.id,
    );

    const [requirements, executionProfiles] = await Promise.all([
      this.requirementReader.findByContributionIds(contributionIds),
      this.executionProfileReader.findByContributionIds(contributionIds),
    ]);

    const executionProfileIds = executionProfiles.map((profile) => profile.id);

    const executionRules =
      await this.executionRuleReader.findByExecutionProfileIds(
        executionProfileIds,
      );

    const source: WorkflowDefinitionSource = {
      template: version.onboardingTemplate,
      version,
      departments,
      contributions,
      requirements,
      executionProfiles,
      executionRules,
    };

    return this.mapper.map(source);
  }
}
