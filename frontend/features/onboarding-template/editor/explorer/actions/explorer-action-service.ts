import type {
  ExplorerNodeType,
} from "../../../workspace";

import {
  EXPLORER_ACTIONS,
} from "./explorer-action-registry";

export class ExplorerActionService {

  static getActions(
    nodeType?: ExplorerNodeType,
  ) {

    return EXPLORER_ACTIONS.filter(
      (action) =>
        action.visibleFor.includes(
          nodeType ?? "template",
        ),
    );

  }

}