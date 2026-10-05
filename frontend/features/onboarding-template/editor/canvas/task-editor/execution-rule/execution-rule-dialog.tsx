"use client";

import { FormDialog } from "@/components/common/form-dialog";

import { ExecutionRuleForm } from "./execution-rule-form";

import type {
  ExecutionRuleRow,
} from "./execution-rule-columns";

interface ExecutionRuleDialogProps {

  open: boolean;

  executionRule?: ExecutionRuleRow;

  onOpenChange(
    open: boolean,
  ): void;

  onSave(
    value: ExecutionRuleRow,
  ): Promise<void> | void;

}

export function ExecutionRuleDialog({

  open,

  executionRule,

  onOpenChange,

  onSave,

}: ExecutionRuleDialogProps) {

  return (

    <FormDialog

      open={open}

      onOpenChange={onOpenChange}

      title={
        executionRule
          ? "Edit Execution Rule"
          : "Add Execution Rule"
      }

      description="Configure execution rule."

      size="xl"

    >

      <ExecutionRuleForm

        executionRule={
          executionRule
        }

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