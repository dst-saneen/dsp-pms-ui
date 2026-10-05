import { Module } from '@nestjs/common';

import {
  WorkflowActorRegistry,
  DefaultWorkflowActorRegistry,
} from './registry';

import {
  WorkflowActorResolution,
  DefaultWorkflowActorResolution,
} from './services';

@Module({
  providers: [
    DefaultWorkflowActorRegistry,
    {
      provide: WorkflowActorRegistry,
      useExisting: DefaultWorkflowActorRegistry,
    },

    DefaultWorkflowActorResolution,
    {
      provide: WorkflowActorResolution,
      useExisting: DefaultWorkflowActorResolution,
    },
  ],

  exports: [WorkflowActorRegistry, WorkflowActorResolution],
})
export class WorkflowActorModule {}
