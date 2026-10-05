import type {
  OnboardingWorkspace,
} from "../../workspace";

import type {
  ValidationIssue,
  ValidationResult,
} from "./validation.types";

export class OnboardingValidator {

  static validate(
    workspace: OnboardingWorkspace,
  ): ValidationResult {

    const issues: ValidationIssue[] = [];

    //
    // Template
    //

    if (
      !workspace.template.templateName?.trim()
    ) {

      issues.push({

        id: crypto.randomUUID(),

        severity: "error",

        target: "template",

        targetId: workspace.template.id,

        title: "Template Name",

        message:
          "Template name is required.",

      });

    }

    const version =
      workspace.template.version;

    if (!version) {

      issues.push({

        id: crypto.randomUUID(),

        severity: "error",

        target: "template",

        targetId: workspace.template.id,

        title: "Version",

        message:
          "Template has no draft version.",

      });

      return {

        valid: false,

        issues,

      };

    }

    //
    // Departments
    //

    if (
      version.departments.length === 0
    ) {

      issues.push({

        id: crypto.randomUUID(),

        severity: "error",

        target: "template",

        targetId: workspace.template.id,

        title: "Departments",

        message:
          "At least one department is required.",

      });

    }

    version.departments.forEach(
      (department) => {

        if (
          department.taskGroups.length === 0
        ) {

          issues.push({

            id: crypto.randomUUID(),

            severity: "warning",

            target: "department",

            targetId: department.id,

            title: "Task Groups",

            message:
              "Department has no task groups.",

          });

        }

        department.taskGroups.forEach(
          (group) => {

            if (
              group.tasks.length === 0
            ) {

              issues.push({

                id: crypto.randomUUID(),

                severity: "warning",

                target: "group",

                targetId: group.id,

                title: "Tasks",

                message:
                  "Task group has no tasks.",

              });

            }

            group.tasks.forEach(
              (task) => {

                if (
                  !task.taskName.trim()
                ) {

                  issues.push({

                    id: crypto.randomUUID(),

                    severity: "error",

                    target: "task",

                    targetId: task.id,

                    title: "Task Name",

                    message:
                      "Task name is required.",

                  });

                }

                if (
                  !task.workType
                ) {

                  issues.push({

                    id: crypto.randomUUID(),

                    severity: "error",

                    target: "task",

                    targetId: task.id,

                    title: "Work Type",

                    message:
                      "Work type is required.",

                  });

                }

              },
            );

          },
        );

      },
    );

    return {

      valid:
        !issues.some(
          (issue) =>
            issue.severity === "error",
        ),

      issues,

    };

  }

}