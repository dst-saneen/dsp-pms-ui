"use client";

import { useState } from "react";

import type {
  OnboardingWorkspace,
} from "../../workspace";

import type {
  OnboardingTemplateTask,
} from "../../types";

import {
  OnboardingTree,
} from "./onboarding-tree";

import {
  OnboardingTreeToolbar,
} from "./onboarding-tree-toolbar";

import {
  AddDepartmentDialog,
} from "./department";

import {
  ExplorerActionService,
  ExplorerActionId,
  type ExplorerAction,
} from "./actions";

import {
  useOnboardingDesigner,
} from "../state";

import {
  AddTaskGroupDialog,
} from "@/features/onboarding-task-group";

import {
  OnboardingTemplateTaskDialog,
} from "@/features/onboarding-template-task";

interface Props {
  workspace: OnboardingWorkspace;
}

export function OnboardingExplorer({
  workspace,
}: Props) {

 
  const [openDepartment, setOpenDepartment] =
    useState(false);

  const [openTaskGroup, setOpenTaskGroup] =
    useState(false);

  const [openTask, setOpenTask] =
    useState(false);

  const {
    state,
  } = useOnboardingDesigner();

  const selectedNode =
    state.selectedNode;

  const version =
    workspace.template.version;

  const selectedDepartment =
    version?.departments.find(
      (department) =>
        department.id === selectedNode?.id,
    );

  const selectedTaskGroup =
    version?.departments
      .flatMap(
        (department) =>
          department.taskGroups ?? [],
      )
      .find(
        (group) =>
          group.id === selectedNode?.id,
      );


  const [
    editingTask,
    setEditingTask,
  ] = useState<
    OnboardingTemplateTask | undefined
  >();


  const versionId =
    version?.id ?? "";

  const departmentCount =
    version?.departments.length ?? 0;

  const currentGroupCount =
    selectedDepartment?.taskGroups?.length ?? 0;

  const currentTaskCount =
    selectedTaskGroup?.tasks?.length ?? 0;

  const actions =
    ExplorerActionService.getActions(
      selectedNode?.type ?? "template",
    );
  
  const handleAction = (
    action: ExplorerAction,
  ) => {

    switch (action.id) {

      case ExplorerActionId.ADD_DEPARTMENT:

        setOpenDepartment(true);

        break;

      case ExplorerActionId.ADD_GROUP:

        if (selectedDepartment) {

          setOpenTaskGroup(true);

        }

        break;

      case ExplorerActionId.ADD_TASK:

        if (selectedTaskGroup) {

          setOpenTask(true);

        }

        break;

    }

  };

  return (

    <div className="flex h-full flex-col">

      <OnboardingTreeToolbar
        actions={actions}
        onAction={handleAction}
      />

      <div className="flex-1 overflow-auto">

        <OnboardingTree
          workspace={workspace}
          onNodeDoubleClick={(node) => {

              if (node.type !== "task") {
                  return;
              }

              const task =
                  version?.departments
                      .flatMap(
                          d => d.taskGroups ?? [],
                      )
                      .flatMap(
                          g => g.tasks ?? [],
                      )
                      .find(
                          t => t.id === node.id,
                      );

              if (!task) {
                  return;
              }

              setEditingTask(task);

              setOpenTask(true);

          }}
        />

      </div>

      <AddDepartmentDialog
        open={openDepartment}
        onClose={() =>
          setOpenDepartment(false)
        }
        templateId={workspace.template.id}
        versionId={versionId}
        currentDepartmentCount={
          departmentCount
        }
      />

      <AddTaskGroupDialog
        open={openTaskGroup}
        onClose={() =>
          setOpenTaskGroup(false)
        }
        templateId={workspace.template.id}
        departmentTemplateId={
          selectedDepartment?.id ?? ""
        }
        currentGroupCount={
          currentGroupCount
        }
      />

      <OnboardingTemplateTaskDialog
        open={openTask}
        onOpenChange={(open) => {

          setOpenTask(open);

          if (!open) {

              setEditingTask(undefined);

          }

        }}
        templateId={workspace.template.id}
        taskGroupId={
            editingTask?.taskGroupId ??
            selectedTaskGroup?.id
        }
        sequenceNo={
          currentTaskCount + 1
        }
        task={editingTask}
      />

    </div>

  );

}