"use client";

import type {
  WorkflowGraphNode,
} from "./workflow-graph.types";

interface Props {
  node: WorkflowGraphNode;
}

export function WorkflowGraphNode({
  node,
}: Props) {

  return (

    <div className="rounded-lg border bg-background p-4 shadow-sm">

      <div className="font-medium">

        {node.label}

      </div>

      <div className="mt-2 text-xs text-muted-foreground">

        {node.id}

      </div>

    </div>

  );

}