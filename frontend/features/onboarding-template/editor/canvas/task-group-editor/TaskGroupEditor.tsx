"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import { useOnboardingDesigner } from "../../state";

import { Button } from "@/components/ui/button";

import { OnboardingTaskGrid } from "./onboarding-task-grid";

export function TaskGroupEditor() {
  const { state } = useOnboardingDesigner();

  const node = state.selectedNode;

  const department =
    state.workspace.template.version?.departments.find((d) =>
      d.taskGroups.some((g) => g.id === node?.id),
    );

  const taskGroup = department?.taskGroups.find((g) => g.id === node?.id);

  if (!department || !taskGroup) {
    return (
      <div className="p-6">
        Select a task group from the department explorer to begin managing onboarding tasks.
      </div>
    );
  }

  return (
    <Card className="h-full border-0 shadow-none">

      <CardHeader className="space-y-4">

        <CardTitle>
          Employee Onboarding Template
        </CardTitle>

        <div className="grid grid-cols-2 gap-8">

          <div className="space-y-1">

            <Label>Owner Department</Label>

            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
              {department.department?.departmentName ?? "-"}
            </div>

          </div>

          <div className="space-y-1">

            <Label>Designation</Label>

            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
              {state.workspace.template.templateName}
            </div>

          </div>

        </div>

        <div className="space-y-1">

          <Label>Version</Label>

          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
            {state.workspace.template.version?.versionName ?? "Draft"}
          </div>

        </div>

      </CardHeader>

      <div className="flex items-center justify-end gap-2 px-6 pb-4">

        <Button>
          Add Task Group
        </Button>

        <Button>
          Add Task
        </Button>

        <Button>
          Publish
        </Button>

      </div>

      <CardContent>
        <OnboardingTaskGrid
          taskGroup={taskGroup}
          inheritedDepartmentName={
            department.department?.departmentName ?? "Enclosing department"
          }
        />
      </CardContent>

    </Card>
  );
}