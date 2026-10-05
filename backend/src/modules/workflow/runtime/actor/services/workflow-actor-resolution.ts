import {
  ActorContext,
  ActorReference,
  ActorResolutionResult,
} from '../contracts';

export abstract class WorkflowActorResolution {
  abstract resolve(
    actor: ActorReference,
    context: ActorContext,
  ): Promise<ActorResolutionResult>;
}
