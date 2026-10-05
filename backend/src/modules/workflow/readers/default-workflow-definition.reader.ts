import { Injectable } from '@nestjs/common';

import { WorkflowDefinition } from '../contracts';

import { WorkflowDefinitionReader } from './workflow-definition.reader';

@Injectable()
export class DefaultWorkflowDefinitionReader extends WorkflowDefinitionReader {
  async find(templateVersionId: string): Promise<WorkflowDefinition> {
    throw new Error(
      `WorkflowDefinitionReader.find(${templateVersionId}) is not implemented.`,
    );
  }
}
