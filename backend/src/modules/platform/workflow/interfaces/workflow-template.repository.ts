export interface WorkflowTemplateRepository {
  findById(id: string): Promise<unknown | null>;

  findByCode(code: string): Promise<unknown | null>;

  findAll(): Promise<unknown[]>;

  create(data: unknown): Promise<unknown>;

  update(id: string, data: unknown): Promise<unknown>;

  deactivate(id: string): Promise<void>;
}
