import { Injectable, NotFoundException } from '@nestjs/common';

import { ActorReference } from '../contracts';

import { WorkflowActorResolver } from '../interfaces';

import { WorkflowActorRegistry } from './workflow-actor-registry';

@Injectable()
export class DefaultWorkflowActorRegistry extends WorkflowActorRegistry {
  private readonly resolvers: WorkflowActorResolver[] = [];

  register(resolver: WorkflowActorResolver): void {
    this.resolvers.push(resolver);
  }

  getResolver(actor: ActorReference): WorkflowActorResolver {
    const resolver = this.resolvers.find((r) => r.supports(actor));

    if (!resolver) {
      throw new NotFoundException(
        `No actor resolver registered for '${actor.type}'.`,
      );
    }

    return resolver;
  }

  getResolvers(): readonly WorkflowActorResolver[] {
    return this.resolvers;
  }
}
