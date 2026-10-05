"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AddTaskGroupDialog,
  useDeleteOnboardingTaskGroup,
} from "@/features/onboarding-task-group";
import {
  OnboardingTemplateTaskDialog,
  useDeleteOnboardingTemplateTask,
} from "@/features/onboarding-template-task";
import { OnboardingWorkspaceService } from "@/features/onboarding-template/services";
import { getApiErrorMessage } from "@/services/api-client";

import { useOnboardingDesigner } from "../editor/state";
import { DepartmentTaskGrid } from "./grid";

export function DepartmentTaskDesigner() {
  const { state, dispatch } = useOnboardingDesigner();
  const params = useParams();
  const queryClient = useQueryClient();

  const template = state.workspace.template;
  const templateId = template.id;
  const version = template.version;
  const departments = useMemo(
    () => version?.departments ?? [],
    [version?.departments],
  );

  const urlDepartmentId = params.departmentId as string | undefined;
  const [pickedDepartmentId, setPickedDepartmentId] = useState<string>("");

  const selectedDepartment = useMemo(() => {
    if (urlDepartmentId) {
      return (
        departments.find(
          (department) => department.departmentId === urlDepartmentId,
        ) ??
        departments.find((department) => department.id === urlDepartmentId)
      );
    }

    if (pickedDepartmentId) {
      return (
        departments.find(
          (department) => department.departmentId === pickedDepartmentId,
        ) ??
        departments.find((department) => department.id === pickedDepartmentId)
      );
    }

    return undefined;
  }, [departments, urlDepartmentId, pickedDepartmentId]);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const deleteTask = useDeleteOnboardingTemplateTask();
  const deleteGroup = useDeleteOnboardingTaskGroup(templateId);

  async function refreshWorkspace() {
    const workspace = await OnboardingWorkspaceService.getEditor(templateId);
    dispatch({
      type: "SET_WORKSPACE",
      payload: workspace,
    });
    await queryClient.invalidateQueries({
      queryKey: ["onboarding-workspace", templateId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["designation-onboarding-workspace"],
    });
  }

  if (departments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No department is linked to this template yet.
        </p>
        <p className="text-muted-foreground text-xs">
          Go back to Onboarding Templates → expand Staff → Add Department.
        </p>
        <Button variant="outline" asChild>
          <Link href="/hr/onboarding-templates">Back to Templates</Link>
        </Button>
      </div>
    );
  }

  if (!selectedDepartment) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <p className="font-medium">Select a department</p>
          <p className="text-muted-foreground text-sm">
            Choose which department checklist to edit. To attach another
            department, go back to the templates list and use Add Department.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {departments.map((department) => {
            const name =
              department.department?.departmentName ??
              department.departmentId;
            const href = `/hr/onboarding-templates/${templateId}/departments/${department.departmentId}`;
            return (
              <div
                key={department.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="text-sm font-medium">{name}</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPickedDepartmentId(department.departmentId)
                    }
                  >
                    Open here
                  </Button>
                  <Button type="button" size="sm" asChild>
                    <Link href={href}>Open department page</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="outline" asChild>
          <Link href="/hr/onboarding-templates">Back to templates list</Link>
        </Button>
      </div>
    );
  }

  const taskGroups = [...(selectedDepartment.taskGroups ?? [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
  );
  const departmentName =
    selectedDepartment.department?.departmentName ?? "Department";
  const versionId = version?.id;
  const dependencyOptions = (version?.departments ?? [])
    .flatMap((department) => department.taskGroups ?? [])
    .flatMap((group) => group.tasks ?? [])
    .map((item) => ({
      id: item.id,
      taskName: item.taskName,
    }));
  const editingTask =
    editingTaskId == null
      ? undefined
      : taskGroups
          .flatMap((group) => group.tasks ?? [])
          .find((item) => item.id === editingTaskId);

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">Department</p>
          <p className="font-medium">{departmentName}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Click a task name to edit. Use Basic fields first; Advanced is
            optional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!urlDepartmentId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickedDepartmentId("")}
            >
              Change department
            </Button>
          ) : null}
          <Button type="button" onClick={() => setAddGroupOpen(true)}>
            Add Task Group
          </Button>
        </div>
      </div>

      {taskGroups.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <p className="font-medium">No task groups yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a group first (for example Day 1), then add tasks inside it.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setAddGroupOpen(true)}
          >
            Add Task Group
          </Button>
        </div>
      ) : (
        <DepartmentTaskGrid
          taskGroups={taskGroups}
          onAddTask={(groupId) => {
            setActiveGroupId(groupId);
            setEditingTaskId(null);
            setTaskDialogOpen(true);
          }}
          onEditTask={(taskId) => {
            const task = taskGroups
              .flatMap((group) => group.tasks ?? [])
              .find((item) => item.id === taskId);
            if (!task) return;
            setActiveGroupId(task.taskGroupId ?? "");
            setEditingTaskId(taskId);
            setTaskDialogOpen(true);
          }}
          onDeleteTask={(taskId) => {
            if (!taskId) return;
            if (!confirm("Delete this onboarding task?")) return;
            const task = taskGroups
              .flatMap((group) => group.tasks ?? [])
              .find((item) => item.id === taskId);
            deleteTask.mutate(
              { id: taskId, expectedVersion: task?.rowVersion ?? 1 },
              {
                onSuccess: () => {
                  toast.success("Task deleted.");
                  void refreshWorkspace();
                },
                onError: (error) => {
                  toast.error(
                    getApiErrorMessage(error, "Could not delete task."),
                  );
                },
              },
            );
          }}
          onDeleteGroup={(groupId) => {
            if (!groupId) return;
            if (
              !confirm(
                "Delete this task group and its tasks from the template?",
              )
            ) {
              return;
            }
            const group = taskGroups.find((item) => item.id === groupId);
            deleteGroup.mutate(
              { id: groupId, expectedVersion: group?.rowVersion ?? 1 },
              {
                onSuccess: () => {
                  toast.success("Task group deleted.");
                  void refreshWorkspace();
                },
                onError: (error) => {
                  toast.error(
                    getApiErrorMessage(error, "Could not delete task group."),
                  );
                },
              },
            );
          }}
        />
      )}

      <AddTaskGroupDialog
        open={addGroupOpen}
        onClose={() => {
          setAddGroupOpen(false);
          void refreshWorkspace();
        }}
        templateId={templateId}
        departmentTemplateId={selectedDepartment.id}
        currentGroupCount={Math.max(
          taskGroups.length,
          ...taskGroups.map((group) => group.displayOrder ?? 0),
          0,
        )}
      />

      <OnboardingTemplateTaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) {
            setEditingTaskId(null);
            void refreshWorkspace();
          }
        }}
        templateId={templateId}
        taskGroupId={activeGroupId || editingTask?.taskGroupId || undefined}
        versionId={versionId}
        dependencyOptions={dependencyOptions}
        task={editingTask as never}
        sequenceNo={
          editingTask
            ? editingTask.sequenceNo
            : (taskGroups.find((group) => group.id === activeGroupId)?.tasks
                ?.length ?? 0) + 1
        }
      />
    </div>
  );
}
