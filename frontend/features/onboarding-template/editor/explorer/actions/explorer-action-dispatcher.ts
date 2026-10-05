import {
  ExplorerActionId,
} from "./explorer-action.model";

export interface ExplorerActionDispatcher {

  dispatch(
    action: ExplorerActionId,
  ): void;

}