"use client";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { OnboardingTaskRow } from "./onboarding-task-row";
import { useOnboardingDesigner } from "../../state";
import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";
import { OnboardingTemplateTaskService } from "@/features/onboarding-template-task";
import { OnboardingWorkspaceService } from "@/features/onboarding-template/services";
import { getApiErrorMessage } from "@/services/api-client";

interface Props {
  taskGroup: OnboardingTaskGroup;
  inheritedDepartmentName?: string;
}

export function OnboardingTaskGrid({
  taskGroup,
  inheritedDepartmentName,
}: Props) {
  const tasks = taskGroup.tasks ?? [];
  const { state, dispatch } = useOnboardingDesigner();
  const departmentName =
    inheritedDepartmentName ??
    taskGroup.departmentTemplate?.department.departmentName ??
    "Enclosing department";

  async function reloadWorkspace() {
    const workspace = await OnboardingWorkspaceService.getEditor(
      state.workspace.template.id,
    );
    dispatch({
      type: "SET_WORKSPACE",
      payload: workspace,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Onboarding Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Tasks are saved on the server. Department owner is inherited from{" "}
            {departmentName}.
          </p>
        </div>

        <Button
          onClick={() => {
            void (async () => {
              try {
                await OnboardingTemplateTaskService.create({
                  taskGroupId: taskGroup.id,
                  taskName: `Task ${tasks.length + 1}`,
                  sequenceNo: tasks.length + 1,
                  isMandatory: true,
                  allowSkip: false,
                  allowReopen: true,
                  workType: "CHECKLIST",
                  ownerType: "DEPARTMENT",
                });
                await reloadWorkspace();
              } catch (error) {
                toast.error(
                  getApiErrorMessage(error, "Could not create task."),
                );
              }
            })();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Seq</TableHead>
              <TableHead>Task Item</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-20">Due (Days)</TableHead>
              <TableHead className="w-24">Required</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <OnboardingTaskRow
                key={task.id}
                task={task}
                inheritedDepartmentName={departmentName}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
