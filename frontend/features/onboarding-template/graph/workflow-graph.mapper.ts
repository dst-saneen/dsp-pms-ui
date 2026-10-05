import type {
  OnboardingWorkspace,
} from "../workspace";

import type {
  WorkflowGraphModel,
} from "./workflow-graph.types";

export class WorkflowGraphMapper {

  static fromWorkspace(
    workspace: OnboardingWorkspace,
  ): WorkflowGraphModel {

    const version =
      workspace.template.version;

    if (!version) {

      return {

        nodes: [],

        edges: [],

      };

    }

    const nodes = [];
    const edges = [];

    for (const department of version.departments) {

      for (const group of department.taskGroups ?? []) {

        for (const task of group.tasks ?? []) {

          nodes.push({

            id: task.id,

            label: task.taskName,

            level: 0,

          });

          for (
            const dependency of
            task.dependencyTaskIds ?? []
          ) {

            edges.push({

              from: dependency,

              to: task.id,

            });

          }

        }

      }

    }

    return {

      nodes,

      edges,

    };

  }

}