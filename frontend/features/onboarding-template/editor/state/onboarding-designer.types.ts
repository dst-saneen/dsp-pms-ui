import type {
  OnboardingWorkspace,
  ExplorerNode,
} from "../../workspace";

import type {
  OnboardingTemplateTask,
} from "../../types";

export interface OnboardingDesignerState {

  workspace: OnboardingWorkspace;

  selectedNode?: ExplorerNode;

  selectedTask?: OnboardingTemplateTask;

  dirty: boolean;

  /**
   * Save lifecycle
   */
  saving: boolean;

  lastSavedAt?: Date;

  saveError?: string;

  /**
   * Dirty tracking
   */
  changedDepartments: Record<string, boolean>;

  changedTaskGroups: Record<string, boolean>;

  changedTasks: Record<string, boolean>;

  changedContributions: Record<string, boolean>;

  changedRequirements: Record<string, boolean>;

  changedExecutionProfiles: Record<string, boolean>;

  changedExecutionRules: Record<string, boolean>;

}
export type OnboardingDesignerAction =
  
  | {
      type:"SELECT_NODE";
      payload?: ExplorerNode;
    }
  | {
      type: "SELECT_TASK";
      payload?: OnboardingTemplateTask;
    }
  | {
      type: "UPDATE_TASK";
      payload: OnboardingTemplateTask;
    }
  | {
      type: "SET_WORKSPACE";
      payload: OnboardingWorkspace;
    }
    | {
    type: "CLEAR_CHANGES";
    }
    | {
        type: "MARK_CHANGED";
        payload: string;
    }
    | {
    type: "ADD_TASK";
    payload: OnboardingTemplateTask;
      }
    | {
        type: "DELETE_TASK";
        payload: string;
      }
    | {
        type: "SAVE_STARTED";
      }

    | {
        type: "SAVE_SUCCESS";
      }

    | {
        type: "SAVE_FAILED";
        payload: string;
      };
