"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ShiftForm } from "../forms/shift-form";

import { useCreateShift } from "../hooks/use-create-shift";
import { useUpdateShift } from "../hooks/use-update-shift";
import { useDeleteShift } from "../hooks/use-delete-shift";

import type { Shift } from "../types/shift";
import type { ShiftFormValues } from "../validation/shift-schema";

import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
}

export function ShiftDialog({
  open,
  onOpenChange,
  shift,
}: ShiftDialogProps) {
  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const createMutation =
    useCreateShift();

  const updateMutation =
    useUpdateShift();

  const deleteMutation =
    useDeleteShift();

  const closeDialog = () => {
    onOpenChange(false);
    setDeleteOpen(false);
  };

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const handleSubmit = (
    data: ShiftFormValues,
  ) => {
    if (shift) {
      updateMutation.mutate(
        {
          id: shift.id,
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
          shift
            ? "Edit Shift"
            : "Create Shift"
        }
        description="Manage shift information"
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <div>
              {shift && (
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
                form="shift-form"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : shift
                  ? "Update"
                  : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <ShiftForm
          shift={shift}
          onSubmit={handleSubmit}
          onCancel={closeDialog}
          isSaving={isSaving}
        />
      </FormDialog>

      {shift && (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Shift"
          name={shift.shiftName}
          code={shift.shiftCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(
              shift.id,
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