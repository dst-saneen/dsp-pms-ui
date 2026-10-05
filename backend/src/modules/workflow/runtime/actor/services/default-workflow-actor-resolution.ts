import { Injectable } from '@nestjs/common';

import {
  ActorContext,
  ActorReference,
  ActorResolutionResult,
} from '../contracts';

import { WorkflowActorRegistry } from '../registry';

import { WorkflowActorResolution } from './workflow-actor-resolution';

@Injectable()
export class DefaultWorkflowActorResolution extends WorkflowActorResolution {
  constructor(private readonly registry: WorkflowActorRegistry) {
    super();
  }

  async resolve(
    actor: ActorReference,
    context: ActorContext,
  ): Promise<ActorResolutionResult> {
    const resolver = this.registry.getResolver(actor);

    return resolver.resolve(actor, context);
  }
}
