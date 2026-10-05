"use client";

import {
  OnboardingTemplateSummary,
} from "./onboarding-template-summary";

import {
  OnboardingDesignerToolbar,
} from "./onboarding-designer-toolbar";

export function OnboardingDesignerHeader() {
  return (
    <div className="border-b bg-background">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <OnboardingTemplateSummary />
        <OnboardingDesignerToolbar />
      </div>
    </div>
  );
}
