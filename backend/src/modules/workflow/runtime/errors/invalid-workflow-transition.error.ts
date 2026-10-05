import { WorkflowRuntimeStatus } from '../instance';

import { WorkflowRuntimeError } from './workflow-runtime.error';

export class InvalidWorkflowTransitionError extends WorkflowRuntimeError {
  constructor(from: WorkflowRuntimeStatus, to: WorkflowRuntimeStatus) {
    super('WF_RT_0001', `Illegal workflow state transition: ${from} -> ${to}`);
  }
}
