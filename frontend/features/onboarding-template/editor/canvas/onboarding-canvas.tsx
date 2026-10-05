"use client";

import {
  useOnboardingDesigner,
} from "../state";

import {
  OnboardingCanvasEmpty,
} from "./onboarding-canvas-empty";

import {
  OnboardingCanvasHeader,
} from "./onboarding-canvas-header";

import {
  OnboardingCanvasContent,
} from "./onboarding-canvas-content";

export function OnboardingCanvas() {

  const {
    state,
  } = useOnboardingDesigner();

  if (!state.selectedNode) {
    return <OnboardingCanvasEmpty />;
  }

  return (
    <div className="flex h-full flex-col">

      <OnboardingCanvasHeader />

      <div className="flex-1 overflow-auto">
        <OnboardingCanvasContent />
      </div>

    </div>
  );
}