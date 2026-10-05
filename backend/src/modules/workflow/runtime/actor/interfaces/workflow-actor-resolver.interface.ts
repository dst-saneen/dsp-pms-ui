import { ActorContext } from '../contracts/actor-context.contract';
import { ActorReference } from '../contracts/actor-reference.contract';
import { ActorResolutionResult } from '../contracts/actor-resolution.contract';

export interface WorkflowActorResolver {
  supports(actor: ActorReference): boolean;

  resolve(
    actor: ActorReference,
    context: ActorContext,
  ): Promise<ActorResolutionResult>;
}
