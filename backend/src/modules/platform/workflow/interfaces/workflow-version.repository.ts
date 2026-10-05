export interface WorkflowVersionRepository {
  findCurrent(templateId: string): Promise<unknown | null>;

  findHistory(templateId: string): Promise<unknown[]>;

  createDraft(data: unknown): Promise<unknown>;

  publish(versionId: string): Promise<unknown>;

  archive(versionId: string): Promise<unknown>;
}
