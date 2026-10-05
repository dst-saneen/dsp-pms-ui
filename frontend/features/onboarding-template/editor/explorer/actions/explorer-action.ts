import type {
  ExplorerNodeType,
} from "../../../workspace";

import {
  ExplorerActionId,
} from "./explorer-action.model";

/**
 * Explorer toolbar action
 */
export interface ExplorerAction {

  id: ExplorerActionId;

  label: string;

  /**
   * Node types where this action is visible
   */
  visibleFor: ExplorerNodeType[];

}