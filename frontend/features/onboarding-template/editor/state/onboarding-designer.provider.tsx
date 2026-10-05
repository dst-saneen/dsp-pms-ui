"use client";

import {
  useEffect,
  useReducer,
} from "react";

import {
  OnboardingDesignerContext,
} from "./onboarding-designer.context";

import {
  onboardingDesignerReducer,
} from "./onboarding-designer.reducer";

import type {
  OnboardingWorkspace,
} from "../../workspace";

interface Props {
  workspace: OnboardingWorkspace;

  children: React.ReactNode;
}

export function OnboardingDesignerProvider({
  workspace,
  children,
}: Props) {

  const [state, dispatch] =
    useReducer(
      onboardingDesignerReducer,
      {
        workspace,

        selectedNode: undefined,

        selectedTask: undefined,

        dirty: false,

        /**
         * Save lifecycle
         */
        saving: false,

        lastSavedAt: undefined,

        saveError: undefined,

        /**
         * Dirty tracking
         */
        changedDepartments: {},

        changedTaskGroups: {},

        changedTasks: {},

        changedContributions: {},

        changedRequirements: {},

        changedExecutionProfiles: {},

        changedExecutionRules: {},
      },
    );

  useEffect(() => {
    dispatch({
      type: "SET_WORKSPACE",
      payload: workspace,
    });
  }, [workspace]);

  return (
    <OnboardingDesignerContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {children}
    </OnboardingDesignerContext.Provider>
  );
}