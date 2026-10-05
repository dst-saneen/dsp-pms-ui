"use client";

import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { useOnboardingTaskRow } from "../../hooks";
import { TASK_PRIORITIES } from "../../shared/task-priority";
import type { OnboardingTemplateTask } from "../../../types";
import { OnboardingTemplateTaskService } from "@/features/onboarding-template-task";
import { OnboardingWorkspaceService } from "@/features/onboarding-template/services";
import { useOnboardingDesigner } from "../../state";
import { getApiErrorMessage } from "@/services/api-client";

interface Props {
  task: OnboardingTemplateTask;
  inheritedDepartmentName: string;
}

export function OnboardingTaskRow({ task, inheritedDepartmentName }: Props) {
  const { update } = useOnboardingTaskRow(task);
  const { state, dispatch } = useOnboardingDesigner();

  return (
    <>
      <TableCell className="w-20 text-center">
        <Input
          type="number"
          min={1}
          className="w-16"
          value={task.sequenceNo}
          onChange={(e) => update("sequenceNo", Number(e.target.value))}
        />
      </TableCell>

      <TableCell className="min-w-[320px]">
        <Input
          value={task.taskName ?? ""}
          placeholder="Task item..."
          onChange={(e) => update("taskName", e.target.value)}
        />
      </TableCell>

      <TableCell className="min-w-[220px]">
        <div className="space-y-1">
          <Select
            value={task.ownerType ?? "DEPARTMENT"}
            onValueChange={(value) => update("ownerType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEPARTMENT">Department</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {task.ownerType === "DEPARTMENT" || !task.ownerType
              ? inheritedDepartmentName
              : "Resolved at runtime"}
          </p>
        </div>
      </TableCell>

      <TableCell className="w-[140px]">
        <Select
          value={String(task.priority ?? 2)}
          onValueChange={(value) => update("priority", Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority.value} value={String(priority.value)}>
                {priority.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="w-[90px]">
        <Input
          type="number"
          min={0}
          className="w-20"
          value={task.dueDays ?? 0}
          onChange={(e) => update("dueDays", Number(e.target.value))}
        />
      </TableCell>

      <TableCell className="w-[120px]">
        <Select
          value={task.isMandatory ? "YES" : "NO"}
          onValueChange={(value) => update("isMandatory", value === "YES")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="YES">Yes</SelectItem>
            <SelectItem value="NO">No</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="w-24 text-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void (async () => {
              try {
                if (!task.rowVersion) {
                  toast.error("Refresh the template before deleting this task.");
                  return;
                }
                await OnboardingTemplateTaskService.delete(task.id, task.rowVersion);
                const workspace = await OnboardingWorkspaceService.getEditor(
                  state.workspace.template.id
                );
                dispatch({
                  type: "SET_WORKSPACE",
                  payload: workspace,
                });
              } catch (error) {
                toast.error(getApiErrorMessage(error, "Could not delete task."));
              }
            })();
          }}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </TableCell>
    </>
  );
}
