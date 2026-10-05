"use client";

import {
  useContext,
} from "react";

import {
  OnboardingDesignerContext,
} from "./onboarding-designer.context";

export function useOnboardingDesigner() {

  const context =
    useContext(
      OnboardingDesignerContext,
    );

  if (!context) {
    throw new Error(
      "useOnboardingDesigner must be used inside OnboardingDesignerProvider",
    );
  }

  return context;
}