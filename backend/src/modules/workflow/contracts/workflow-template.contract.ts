export interface WorkflowTemplate {
  readonly id: string;

  readonly templateCode?: string;

  readonly templateName: string;

  readonly description?: string;

  readonly lifecycle: string;

  readonly isDefault: boolean;
}
