"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

import { DepartmentForm } from "../forms/department-form";

import { useCreateDepartment } from "../hooks/use-create-department";
import { useUpdateDepartment } from "../hooks/use-update-department";
import { useDeleteDepartment } from "../hooks/use-delete-department";

import type { Department } from "../types/department";
import type { DepartmentFormValues } from "../validation/department-schema";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
}: DepartmentDialogProps) {
  const createMutation = useCreateDepartment();

  const updateMutation = useUpdateDepartment();

  const deleteMutation = useDeleteDepartment();

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const closeDialog = () => {
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = (
    data: DepartmentFormValues,
  ) => {
    if (department) {
      updateMutation.mutate(
        {
          id: department.id,
          data,
        },
        {
          onSuccess: closeDialog,
        },
      );

      return;
    }

    createMutation.mutate(data, {
      onSuccess: closeDialog,
    });
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          department
            ? "Edit Department"
            : "Create Department"
        }
        description="Manage department information"
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <div>
              {department && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setDeleteOpen(true)
                  }
                >
                  Delete
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                form="department-form"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : department
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <DepartmentForm
          department={department}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </FormDialog>

      {department && (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Department"
          name={department.departmentName}
          code={department.departmentCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(
              department.id,
              {
                onSuccess: closeDialog,
              },
            )
          }
        />
      )}
    </>
  );
}