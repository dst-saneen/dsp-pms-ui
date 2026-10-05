export interface WorkflowVersion {
  readonly id: string;

  readonly versionNo: number;

  readonly versionName?: string;

  readonly status: string;

  readonly isCurrent: boolean;

  readonly effectiveFrom?: Date;
}
