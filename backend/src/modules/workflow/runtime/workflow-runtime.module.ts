import { Module } from '@nestjs/common';

import { WorkflowActorModule } from './actor';

import { WorkflowInstanceFactory } from './workflow-instance.factory';

import {
  DefaultWorkflowStateMachine,
  DefaultWorkflowValidator,
  DefaultWorkflowNavigator,
  WorkflowInstanceUpdater,
  WorkflowExecutionResultAggregator,
  DefaultWorkflowPluginManager,
  DefaultWorkflowExecutionCoordinator,
  DefaultWorkflowExecutionEngine,
} from './services';

import { DefaultWorkflowRuleExecutorRegistry } from './registry';

import { DefaultWorkflowRuntimeBootstrap } from './bootstrap';

@Module({
  imports: [WorkflowActorModule],
  providers: [
    DefaultWorkflowStateMachine,
    DefaultWorkflowValidator,
    DefaultWorkflowNavigator,

    WorkflowInstanceFactory,
    WorkflowInstanceUpdater,
    WorkflowExecutionResultAggregator,

    DefaultWorkflowPluginManager,
    DefaultWorkflowRuleExecutorRegistry,
    DefaultWorkflowRuntimeBootstrap,

    DefaultWorkflowExecutionCoordinator,
    DefaultWorkflowExecutionEngine,
  ],
  exports: [
    WorkflowActorModule,

    DefaultWorkflowStateMachine,
    DefaultWorkflowValidator,
    DefaultWorkflowNavigator,

    WorkflowInstanceFactory,
    WorkflowInstanceUpdater,
    WorkflowExecutionResultAggregator,

    DefaultWorkflowPluginManager,
    DefaultWorkflowRuleExecutorRegistry,
    DefaultWorkflowRuntimeBootstrap,

    DefaultWorkflowExecutionCoordinator,
    DefaultWorkflowExecutionEngine,
  ],
})
export class WorkflowRuntimeModule {}
