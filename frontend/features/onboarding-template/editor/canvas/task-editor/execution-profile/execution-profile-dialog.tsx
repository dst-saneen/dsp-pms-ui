"use client";

import { FormDialog } from "@/components/common/form-dialog";

import { ExecutionProfileForm } from "./execution-profile-form";

import type {
  ExecutionProfileRow,
} from "./execution-profile-columns";

interface ExecutionProfileDialogProps {

  open: boolean;

  executionProfile?: ExecutionProfileRow;

  onOpenChange(
    open: boolean,
  ): void;

  onSave(
    value: ExecutionProfileRow,
  ): Promise<void> | void;
}

export function ExecutionProfileDialog({

  open,

  executionProfile,

  onOpenChange,

  onSave,

}: ExecutionProfileDialogProps) {

  return (

    <FormDialog

      open={open}

      onOpenChange={onOpenChange}

      title={
        executionProfile
          ? "Edit Execution Profile"
          : "Add Execution Profile"
      }

      description="Configure execution profile."

      size="xl"

    >

      <ExecutionProfileForm

        executionProfile={
          executionProfile
        }

        onSubmit={async (
          value,
        ) => {

          await onSave(
            value,
          );

          onOpenChange(
            false,
          );

        }}

        onCancel={() =>
          onOpenChange(
            false,
          )
        }

      />

    </FormDialog>

  );

}