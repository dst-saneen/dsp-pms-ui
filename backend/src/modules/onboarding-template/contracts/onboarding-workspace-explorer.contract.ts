export type OnboardingExplorerNodeType =
  'template' | 'department' | 'group' | 'task';

export interface OnboardingExplorerNode {
  readonly id: string;

  readonly parentId?: string;

  readonly type: OnboardingExplorerNodeType;

  readonly title: string;

  readonly subtitle?: string;

  readonly expanded?: boolean;

  readonly children?: OnboardingExplorerNode[];
}

export interface OnboardingWorkspaceExplorer {
  readonly nodes: OnboardingExplorerNode[];
}
