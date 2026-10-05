"use client";

import {
  useOnboardingDesigner,
} from "../state";

import {
  OnboardingVersionBadge,
} from "./onboarding-version-badge";

export function OnboardingTemplateSummary() {

  const {
    state,
  } = useOnboardingDesigner();

  const template =
    state.workspace.template;

  return (

    <div className="space-y-2">

      <div className="text-2xl font-semibold">

        {template.templateName}

      </div>

      <div className="text-sm text-muted-foreground">

        {template.templateCode}

      </div>

      <OnboardingVersionBadge />

    </div>

  );

}