import { createContext } from "react";

import type {
  Dispatch,
} from "react";

import type {
  OnboardingDesignerAction,
  OnboardingDesignerState,
} from "./onboarding-designer.types";

export interface OnboardingDesignerContextValue {

  state: OnboardingDesignerState;

  dispatch:
    Dispatch<OnboardingDesignerAction>;
}

export const OnboardingDesignerContext =
  createContext<
    OnboardingDesignerContextValue | null
  >(null);