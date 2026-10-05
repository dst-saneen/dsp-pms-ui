import type {
  OnboardingDesignerState,
} from "./onboarding-designer.types";

import type {
  OnboardingTemplateTask,
} from "../../types";

function updateDepartments(
  state: OnboardingDesignerState,
  updater: (
    task: OnboardingTemplateTask,
  ) => OnboardingTemplateTask | null,
) {
  const version =
    state.workspace.template.version;

  if (!version) {
    return [];
  }

  return version.departments.map(
    (department) => ({

      ...department,

      taskGroups: (
        department.taskGroups ?? []
      ).map((group) => ({

        ...group,

        tasks: (
          group.tasks ?? []
        )
          .map((task) =>
            updater(task),
          )
          .filter(
            (
              task,
            ): task is OnboardingTemplateTask =>
              task !== null,
          ),

      })),

    }),
  );
}

export function updateTask(
  state: OnboardingDesignerState,
  task: OnboardingTemplateTask,
): OnboardingDesignerState {

  const version =
    state.workspace.template.version;

  if (!version) {
    return state;
  }

  return {

    ...state,

    workspace: {

      ...state.workspace,

      template: {

        ...state.workspace.template,

        version: {

          ...version,

          departments:
            updateDepartments(
              state,
              (existing) =>
                existing.id === task.id
                  ? task
                  : existing,
            ),

        },

      },

    },

    selectedTask: task,

    changedTasks: {

      ...state.changedTasks,

      [task.id]: true,

    },

    dirty: true,

  };

}

export function addTask(
  state: OnboardingDesignerState,
  task: OnboardingTemplateTask,
): OnboardingDesignerState {

  const version =
    state.workspace.template.version;

  if (!version) {
    return state;
  }

  return {

    ...state,

    workspace: {

      ...state.workspace,

      template: {

        ...state.workspace.template,

        version: {

          ...version,

          departments:
            version.departments.map(
              (department) => ({

                ...department,

                taskGroups:
                  (
                    department.taskGroups ??
                    []
                  ).map((group) => {

                    if (
                      group.id !==
                      task.taskGroupId
                    ) {
                      return group;
                    }

                    return {

                      ...group,

                      tasks: [

                        ...(group.tasks ??
                          []),

                        task,

                      ],

                    };

                  }),

              }),
            ),

        },

      },

    },

    selectedTask: task,

    changedTasks: {

      ...state.changedTasks,

      [task.id]: true,

    },

    dirty: true,

  };

}

export function deleteTask(
  state: OnboardingDesignerState,
  taskId: string,
): OnboardingDesignerState {

  const version =
    state.workspace.template.version;

  if (!version) {
    return state;
  }

  const selectedTask =
    state.selectedTask?.id ===
    taskId
      ? undefined
      : state.selectedTask;

  const changedTasks = {
    ...state.changedTasks,
  };

  delete changedTasks[taskId];

  return {

    ...state,

    workspace: {

      ...state.workspace,

      template: {

        ...state.workspace.template,

        version: {

          ...version,

          departments:
            updateDepartments(
              state,
              (task) =>
                task.id === taskId
                  ? null
                  : task,
            ),

        },

      },

    },

    selectedTask,

    changedTasks,

    dirty: true,

  };

}