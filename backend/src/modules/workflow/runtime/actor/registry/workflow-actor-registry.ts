import { ActorReference } from '../contracts';

import { WorkflowActorResolver } from '../interfaces';

export abstract class WorkflowActorRegistry {
  abstract register(resolver: WorkflowActorResolver): void;

  abstract getResolver(actor: ActorReference): WorkflowActorResolver;

  abstract getResolvers(): readonly WorkflowActorResolver[];
}
