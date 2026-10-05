import { Injectable } from '@nestjs/common';

import { WorkflowVersionRepository } from '../interfaces/workflow-version.repository';

@Injectable()
export class WorkflowVersionPrismaRepository implements WorkflowVersionRepository {
  async findCurrent(templateId: string): Promise<unknown | null> {
    throw new Error('Not implemented.');
  }

  async findHistory(templateId: string): Promise<unknown[]> {
    throw new Error('Not implemented.');
  }

  async createDraft(data: unknown): Promise<unknown> {
    throw new Error('Not implemented.');
  }

  async publish(versionId: string): Promise<unknown> {
    throw new Error('Not implemented.');
  }

  async archive(versionId: string): Promise<unknown> {
    throw new Error('Not implemented.');
  }
}
