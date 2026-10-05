import { WorkflowDefinition } from '../contracts';

import { WorkflowReader } from './workflow-reader.interface';

export abstract class WorkflowDefinitionReader implements WorkflowReader<
  string,
  WorkflowDefinition
> {
  abstract find(templateVersionId: string): Promise<WorkflowDefinition>;
}
