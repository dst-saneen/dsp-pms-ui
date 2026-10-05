"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  AddDepartmentDialog,
} from "./add-department-dialog";

import {
  useAddDesignationDepartment,
} from "@/features/designation/hooks";

import {
  useDeleteOnboardingDepartmentTemplate,
} from "../hooks";

import { useRouter } from "next/navigation";

import type { OnboardingDepartmentTemplate } from "@/features/onboarding-department-template";

/** Minimal department shape used by the designation onboarding list. */
type DepartmentListItem = Pick<
  OnboardingDepartmentTemplate,
  "id" | "departmentId" | "rowVersion"
> & {
  department?: {
    id?: string;
    departmentCode?: string;
    departmentName?: string;
  };
  taskGroups?: {
    id?: string;
    groupName?: string;
    tasks?: { id?: string }[];
  }[];
};

interface Props {
  templateId: string;
  designationId: string;
  departments: DepartmentListItem[];
  readOnly?: boolean;
}

export function DepartmentListCell({
  templateId,
  designationId,
  departments,
  readOnly = false,
}: Props) {

    const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const createDepartment =
    useAddDesignationDepartment();

  const deleteDepartment =
    useDeleteOnboardingDepartmentTemplate();

  const sortedDepartments = [...departments].sort(
    (a, b) =>
        (a.department?.departmentName ?? "").localeCompare(
        b.department?.departmentName ?? "",
        ),
    );

  return (
    <div className="space-y-2">

      <Button
        variant="ghost"
        className="h-auto p-0 font-normal"
        onClick={() =>
          setExpanded(!expanded)
        }
      >
        {expanded ? (
          <ChevronDown className="mr-1 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-1 h-4 w-4" />
        )}

        {departments.length} Department
        {departments.length === 1 ? "" : "s"}
      </Button>

      {expanded && (

        <div className="ml-5 space-y-2">

          {sortedDepartments.map(
            (department) => {

              const taskCount =
                (department.taskGroups ?? []).reduce(
                  (
                    groupTotal: number,
                    group,
                  ) =>
                    groupTotal +
                    (group.tasks?.length ?? 0),
                  0,
                );

              return (

                <div
                    key={department.id}
                    className="flex items-center justify-between rounded-md border p-2"
                    >

                    <div>

                        <Button
                          variant="link"
                          className="h-auto p-0 justify-start font-medium"
                          onClick={() =>
                            router.push(
                              `/hr/onboarding-templates/${templateId}/departments/${department.departmentId}`,
                            )
                          }
                        >
                          {department.department?.departmentName}
                        </Button>

                        <div className="text-xs text-muted-foreground">
                          {taskCount} Tasks
                        </div>

                    </div>

                    <div className="flex items-center gap-2">

                        {!readOnly ? (
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {

                            if (
                            confirm(
                                "Remove this department from the onboarding template?",
                            )
                            ) {
                            deleteDepartment.mutate({
                                id: department.id,
                                expectedVersion: department.rowVersion,
                            });
                            }

                        }}
                        >
                        <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        ) : null}

                    </div>

                    </div>

              );

            },
          )}

          {!readOnly ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setDialogOpen(true)
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              Activate the designation before editing departments.
            </p>
          )}

        </div>

      )}

      {!readOnly ? (
      <AddDepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingDepartmentIds={departments.map(
          (department) =>
            String(
              department.departmentId,
            ),
        )}
        onAdd={(departmentId) => {

            return createDepartment.mutateAsync(
                {
                    designationId,
                    departmentId,
                },
                );

            }}
      />
      ) : null}

    </div>
  );
}
