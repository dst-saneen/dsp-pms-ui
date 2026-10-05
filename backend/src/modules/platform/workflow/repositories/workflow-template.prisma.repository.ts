import { Injectable } from '@nestjs/common';

import { WorkflowTemplateRepository } from '../interfaces/workflow-template.repository';

@Injectable()
export class WorkflowTemplatePrismaRepository implements WorkflowTemplateRepository {
  async findById(id: string): Promise<unknown | null> {
    throw new Error('Not implemented.');
  }

  async findByCode(code: string): Promise<unknown | null> {
    throw new Error('Not implemented.');
  }

  async findAll(): Promise<unknown[]> {
    throw new Error('Not implemented.');
  }

  async create(data: unknown): Promise<unknown> {
    throw new Error('Not implemented.');
  }

  async update(id: string, data: unknown): Promise<unknown> {
    throw new Error('Not implemented.');
  }

  async deactivate(id: string): Promise<void> {
    throw new Error('Not implemented.');
  }
}
