"use client";

import { useCallback } from "react";

import { useOnboardingDesigner } from "../state";
import { OnboardingDesignerSaveService } from "../services/onboarding-designer-save.service";

export function useSaveDesigner() {
  const { state, dispatch } = useOnboardingDesigner();

  const save = useCallback(async () => {
    dispatch({
      type: "SAVE_STARTED",
    });

    try {
      const workspace = await OnboardingDesignerSaveService.save(state);

      dispatch({
        type: "SET_WORKSPACE",
        payload: workspace,
      });

      dispatch({
        type: "SAVE_SUCCESS",
      });

      dispatch({
        type: "CLEAR_CHANGES",
      });

      return workspace;
    } catch (error) {
      dispatch({
        type: "SAVE_FAILED",
        payload:
          error instanceof Error ? error.message : "Unable to save designer.",
      });

      throw error;
    }
  }, [state, dispatch]);

  return {
    save,
  };
}
