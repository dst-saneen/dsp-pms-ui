"use client";

import { useMemo } from "react";

import { useOnboardingDesigner } from "../state";

export function useTaskMatrix() {
  const { state, dispatch } = useOnboardingDesigner();

  const rows = useMemo(() => {
    const version = state.workspace.template.version;

    if (!version) {
      return [];
    }

    return version.departments.flatMap((department) =>
      (department.taskGroups ?? []).flatMap((group) =>
        (group.tasks ?? []).map((task) => ({
          ...task,

          departmentId: department.id,

          departmentName:
            department.department?.departmentName ?? "",

          taskGroupName: group.groupName,
        })),
      ),
    );
  }, [state.workspace]);

  function updateRow(row: typeof rows[number]) {
    dispatch({
      type: "UPDATE_TASK",
      payload: row,
    });
  }

  return {
    rows,
    selectedTask: state.selectedTask,
    updateRow,
    dispatch,
  };
}