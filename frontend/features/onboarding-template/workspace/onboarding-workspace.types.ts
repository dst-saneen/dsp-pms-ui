import type {
  OnboardingTemplate,
} from "../types";

import type {
  ExplorerNode,
} from "./onboarding-workspace-explorer";

export interface OnboardingWorkspaceMetadata {
  editable: boolean;

  published: boolean;
}

export interface OnboardingWorkspaceExplorer {
  nodes: ExplorerNode[];
}

export interface OnboardingWorkspace {
  template: OnboardingTemplate;

  explorer: OnboardingWorkspaceExplorer;

  metadata: OnboardingWorkspaceMetadata;
}