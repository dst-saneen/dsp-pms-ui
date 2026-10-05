"use client";

import type {
  OnboardingWorkspace,
} from "../workspace";

import {
  WorkflowGraphMapper,
} from "./workflow-graph.mapper";

import {
  WorkflowGraphNode,
} from "./workflow-graph-node";

interface Props {
  workspace: OnboardingWorkspace;
}

export function WorkflowGraph({
  workspace,
}: Props) {

  const graph =
    WorkflowGraphMapper.fromWorkspace(
      workspace,
    );

  return (

    <div className="space-y-6 p-6">

      {graph.nodes.map((node) => {

        const incoming =
          graph.edges.filter(
            (edge) =>
              edge.to === node.id,
          );

        return (

          <div
            key={node.id}
            className="space-y-3"
          >

            {incoming.length > 0 && (

              <div className="text-xs text-muted-foreground">

                Depends On:

                <ul className="ml-4 list-disc">

                  {incoming.map((edge) => {

                    const dependency =
                      graph.nodes.find(
                        (item) =>
                          item.id === edge.from,
                      );

                    return (

                      <li key={edge.from}>

                        {dependency?.label}

                      </li>

                    );

                  })}

                </ul>

              </div>

            )}

            <WorkflowGraphNode
              node={node}
            />

          </div>

        );

      })}

    </div>

  );

}