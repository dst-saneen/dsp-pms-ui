"use client";

import { useOnboardingDesigner } from "../state";
import type { OnboardingTemplateTask } from "../../types";

export function useOnboardingTaskRow(task: OnboardingTemplateTask) {
  const { dispatch } = useOnboardingDesigner();

  function update<K extends keyof OnboardingTemplateTask>(
    field: K,
    value: OnboardingTemplateTask[K],
  ) {
    dispatch({
      type: "UPDATE_TASK",
      payload: {
        ...task,
        [field]: value,
      },
    });
  }

  function remove() {
    dispatch({
      type: "DELETE_TASK",
      payload: task.id,
    });
  }

  return {
    update,
    remove,
  };
}
