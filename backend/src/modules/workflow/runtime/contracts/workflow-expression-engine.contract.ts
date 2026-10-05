import { WorkflowContext } from '../kernel';

export interface WorkflowExpressionEngine {
  evaluate<T = unknown>(
    expression: string,
    context: WorkflowContext,
  ): Promise<T>;

  canEvaluate(expression: string): boolean;
}
