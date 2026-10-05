"use client";

import { FormDialog } from "@/components/common/form-dialog";

import { RequirementForm } from "./requirement-form";
import type {
  RequirementRow,
} from "./requirement-columns";

interface RequirementDialogProps {

  open: boolean;

  requirement?: RequirementRow;

  onOpenChange(
    open: boolean,
  ): void;

  onSave(
    value: RequirementRow,
  ): Promise<void> | void;

}

export function RequirementDialog({

  open,

  requirement,

  onOpenChange,

  onSave,

}: RequirementDialogProps) {

  return (

    <FormDialog

      open={open}

      onOpenChange={onOpenChange}

      title={
        requirement
          ? "Edit Requirement"
          : "Add Requirement"
      }

      description="Configure requirement definition."

      size="xl"

    >

      <RequirementForm

        requirement={requirement}

        onSubmit={async value => {

          await onSave(value);

          onOpenChange(false);

        }}

        onCancel={() =>
          onOpenChange(false)
        }

      />

    </FormDialog>

  );

}