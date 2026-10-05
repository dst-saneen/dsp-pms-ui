import { OnboardingWorkspaceExplorer } from './onboarding-workspace-explorer.contract';

export interface OnboardingTemplateEditorMetadata {
  readonly editable: boolean;

  readonly published: boolean;
}

export interface OnboardingTemplateEditor {
  readonly template: any;

  readonly explorer: OnboardingWorkspaceExplorer;

  readonly metadata: OnboardingTemplateEditorMetadata;
}
