"use client";

import type {
  OnboardingWorkspace,
  ExplorerNode,
} from "../../workspace";

import {
  OnboardingTreeNode,
} from "./onboarding-tree-node";

interface Props {
  workspace: OnboardingWorkspace;

  onNodeDoubleClick?(
    node: ExplorerNode,
  ): void;
}

export function OnboardingTree({
  workspace,
  onNodeDoubleClick,
}: Props) {
  return (
    <div className="p-2">
      {workspace.explorer.nodes.map((node) => (
        <OnboardingTreeNode
          key={node.id}
          node={node}
          onNodeDoubleClick={
            onNodeDoubleClick
          }
        />
      ))}
    </div>
  );
}