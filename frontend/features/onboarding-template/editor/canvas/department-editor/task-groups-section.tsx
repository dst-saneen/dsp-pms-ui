"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  useOnboardingDesigner,
} from "../../state";

import {
  AddTaskGroupDialog,
} from "@/features/onboarding-task-group";


import {
  useOnboardingTaskGroupsByDepartment,
} from "@/features/onboarding-task-group";

export function TaskGroupsSection() {

  const [open, setOpen] =
    useState(false);

  const {
    state,
    dispatch,
  } = useOnboardingDesigner();

  const selectedNode =
    state.selectedNode;

  const templateId =
    state.workspace.template.id;

  const {
    data: groups = [],
    isLoading,
  } =
  useOnboardingTaskGroupsByDepartment(
    selectedNode?.id ?? "",
  );

  return (

    <Card>

      <CardHeader className="flex flex-row items-center justify-between">

        <CardTitle>

          Task Groups

        </CardTitle>

        <Button
          size="sm"
          onClick={() =>
            setOpen(true)
          }
        >
          Add Task Group
        </Button>

      </CardHeader>

      <CardContent>

        {isLoading && (
          <p>
            Loading...
          </p>
        )}

        {!isLoading &&
          groups.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No task groups added.
            </p>
          )}

        {groups.map((group) => (

          <Button
            key={group.id}
            variant="ghost"
            className="w-full justify-start"

            onClick={() => {

                dispatch({
                    type: "SELECT_NODE",
                    payload: {
                        id: group.id,
                        type: "group",
                        title: group.groupName,
                    },
                });

            }}
            >

            {group.groupName}

          </Button>

        ))}

      </CardContent>

      <AddTaskGroupDialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
        templateId={templateId}
        departmentTemplateId={
            selectedNode?.id ?? ""
        }
        currentGroupCount={
          groups.length
        }
      />

    </Card>

  );

}