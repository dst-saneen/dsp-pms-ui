import {
  ExplorerActionId,
} from "./explorer-action.model";

import type {
  ExplorerAction,
} from "./explorer-action";

export const EXPLORER_ACTIONS: ExplorerAction[] = [

  {
    id: ExplorerActionId.ADD_DEPARTMENT,

    label: "Department",

    visibleFor: [
      "template",
    ],
  },

  {
    id: ExplorerActionId.ADD_GROUP,

    label: "Task Group",

    visibleFor: [
      "department",
    ],
  },

  {
    id: ExplorerActionId.ADD_TASK,

    label: "Task",

    visibleFor: [
      "group",
    ],
  },


];