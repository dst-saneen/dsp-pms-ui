import { WorkflowContext } from '../kernel';

export interface WorkflowEventPublisher {
  publish<TEvent = unknown>(
    event: TEvent,
    context: WorkflowContext,
  ): Promise<void>;

  publishMany<TEvent = unknown>(
    events: readonly TEvent[],
    context: WorkflowContext,
  ): Promise<void>;

  canPublish<TEvent = unknown>(event: TEvent): boolean;
}
