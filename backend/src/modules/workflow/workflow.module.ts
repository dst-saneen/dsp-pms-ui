import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WorkflowDefinitionBuilder } from './builders/workflow-definition.builder';
import { WorkflowDefinitionMapper } from './transformers/workflow-definition.mapper';

import { ContributionReader } from './readers/contribution.reader';
import { DepartmentTemplateReader } from './readers/department-template.reader';
import { ExecutionProfileReader } from './readers/execution-profile.reader';
import { ExecutionRuleReader } from './readers/execution-rule.reader';
import { RequirementReader } from './readers/requirement.reader';
import { TemplateVersionReader } from './readers/template-version.reader';
import {
  DepartmentRuntimeTransformer,
  ContributionRuntimeTransformer,
  RequirementRuntimeTransformer,
  ExecutionProfileRuntimeTransformer,
  ExecutionRuleRuntimeTransformer,
} from './transformers';

import { RuntimeWorkflowBuilder } from './builders';

import {
  WorkflowDefinitionReader,
  DefaultWorkflowDefinitionReader,
} from './readers';

import { WorkflowGenerator } from './generators/workflow.generator';

@Module({
  imports: [PrismaModule],

  providers: [
    DefaultWorkflowDefinitionReader,
    {
      provide: WorkflowDefinitionReader,
      useExisting: DefaultWorkflowDefinitionReader,
    },

    ContributionReader,
    DepartmentTemplateReader,
    ExecutionProfileReader,
    ExecutionRuleReader,
    RequirementReader,
    TemplateVersionReader,
    RuntimeWorkflowBuilder,

    WorkflowDefinitionMapper,
    WorkflowDefinitionBuilder,
    ExecutionRuleRuntimeTransformer,
    ExecutionProfileRuntimeTransformer,
    RequirementRuntimeTransformer,
    ContributionRuntimeTransformer,
    DepartmentRuntimeTransformer,
    WorkflowGenerator,
  ],

  exports: [WorkflowDefinitionBuilder, WorkflowDefinitionReader],
})
export class WorkflowModule {}
