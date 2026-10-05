"use client";

import { useMemo } from "react";

import { useOnboardingDesigner } from "../../../state";

import type { OnboardingTemplateTask } from "../../../../types";
import type { OnboardingDepartmentTemplate } from "@/features/onboarding-department-template";

export function useTaskEditor() {
  const { state, dispatch } = useOnboardingDesigner();

  const enclosingDepartment = useMemo(() => {
    const version = state.workspace.template.version;
    if (!version || state.selectedNode?.type !== "task") {
      return undefined;
    }

    return version.departments.find((department) =>
      (department.taskGroups ?? []).some((group) =>
        (group.tasks ?? []).some((item) => item.id === state.selectedNode?.id),
      ),
    );
  }, [state.workspace, state.selectedNode]);

  const task = useMemo(() => {
    if (!enclosingDepartment || state.selectedNode?.type !== "task") {
      return undefined;
    }

    return enclosingDepartment.taskGroups
      ?.flatMap((group) => group.tasks ?? [])
      .find((item) => item.id === state.selectedNode?.id);
  }, [enclosingDepartment, state.selectedNode]);

  const allTasks = useMemo(() => {
    const version = state.workspace.template.version;

    if (!version) {
      return [];
    }

    return version.departments
      .flatMap((department) => department.taskGroups ?? [])
      .flatMap((group) => group.tasks ?? [])
      .filter((item) => item.id !== task?.id);
  }, [state.workspace, task]);

  function updateTask<K extends keyof OnboardingTemplateTask>(
    field: K,
    value: OnboardingTemplateTask[K],
  ) {
    if (!task) {
      return;
    }

    dispatch({
      type: "UPDATE_TASK",
      payload: {
        ...task,
        [field]: value,
      },
    });
  }

  function updateTaskAggregate(updates: Partial<OnboardingTemplateTask>) {
    if (!task) {
      return;
    }

    dispatch({
      type: "UPDATE_TASK",
      payload: {
        ...task,
        ...updates,
      },
    });
  }

  return {
    task,
    enclosingDepartment: enclosingDepartment as
      | OnboardingDepartmentTemplate
      | undefined,
    updateTask,
    updateTaskAggregate,
    allTasks,
    saving: state.saving,
    isLoading: false,
  };
}
