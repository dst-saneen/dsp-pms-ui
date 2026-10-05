"use client";

import type {
  OnboardingWorkspace,
} from "../../workspace";

import {
  OnboardingDesignerProvider,
} from "../state";

import {
  OnboardingDesignerLayout,
} from "./onboarding-designer-layout";

interface Props {
  workspace: OnboardingWorkspace;
  embedded?: boolean;
}

export function OnboardingTemplateDesigner({
  workspace,
  embedded = false,
}: Props) {
  const content = (
    <OnboardingDesignerLayout
      workspace={workspace}
      embedded={embedded}
    />
  );

  if (embedded) {
    return content;
  }

  return (
    <OnboardingDesignerProvider
      workspace={workspace}
    >
      {content}
    </OnboardingDesignerProvider>
  );
}