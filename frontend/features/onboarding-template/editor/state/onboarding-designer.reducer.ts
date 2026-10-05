import {
  OnboardingDesignerAction,
  OnboardingDesignerState,
} from "./onboarding-designer.types";

import {
  addTask,
  deleteTask,
  updateTask,
} from "./workspace.utils";

export function onboardingDesignerReducer(
  state: OnboardingDesignerState,
  action: OnboardingDesignerAction,
): OnboardingDesignerState {
  switch (action.type) {

    case "SELECT_NODE":
      return {
        ...state,
        selectedNode: action.payload,
      };

    case "SELECT_TASK":
      return {
        ...state,
        selectedTask: action.payload,
      };

    case "UPDATE_TASK":
    return updateTask(
      state,
      action.payload,
    );

    case "ADD_TASK":
      return addTask(
        state,
        action.payload,
      );

    case "DELETE_TASK":
      return deleteTask(
        state,
        action.payload,
      );

    case "SAVE_STARTED":

      return {

        ...state,

        saving: true,

        saveError: undefined,

      };

    case "SAVE_SUCCESS":

      return {

        ...state,

        saving: false,

        lastSavedAt: new Date(),

        saveError: undefined,

      };

    case "SAVE_FAILED":

      return {

        ...state,

        saving: false,

        saveError: action.payload,

      };

    case "CLEAR_CHANGES":

      return {

        ...state,

        dirty: false,

        changedDepartments: {},

        changedTaskGroups: {},

        changedTasks: {},

        changedContributions: {},

        changedRequirements: {},

        changedExecutionProfiles: {},

        changedExecutionRules: {},

      };

    case "SET_WORKSPACE":

      return {

        ...state,

        workspace: action.payload,

        changedDepartments: {},

        changedTaskGroups: {},

        changedTasks: {},

        changedContributions: {},

        changedRequirements: {},

        changedExecutionProfiles: {},

        changedExecutionRules: {},

        dirty: false,

        // Preserve selection
        selectedNode: state.selectedNode,

        selectedTask: state.selectedTask,

      };

    default:
      return state;
  }
}