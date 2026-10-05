import type { OnboardingWorkspace } from "../../workspace";
import type { ExplorerNode } from "../../workspace/onboarding-workspace-explorer";
import type { OnboardingTreeItem } from "./onboarding-tree.model";

export class OnboardingTreeMapper {

  static fromWorkspace(
    workspace: OnboardingWorkspace,
  ): OnboardingTreeItem[] {

    return workspace.explorer.nodes.map((node) =>
      this.mapNode(node),
    );

  }

  private static mapNode(
    node: ExplorerNode,
  ): OnboardingTreeItem {

    return {

      id: node.id,

      type: node.type as OnboardingTreeItem["type"],

      title: node.title,

      children:
        (node.children ?? []).map((child) =>
          this.mapNode(child),
        ),

    };

  }

}
