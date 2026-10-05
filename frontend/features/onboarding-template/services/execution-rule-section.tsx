"use client";

import { useState } from "react";

import {
  ExecutionRuleToolbar,
} from "../editor/canvas/task-editor/execution-rule";

import {
  ExecutionRuleTable,
} from "../editor/canvas/task-editor/execution-rule";

import {
  ExecutionRuleDialog,
} from "../editor/canvas/task-editor/execution-rule";

import type {
  ExecutionRuleRow,
} from "../editor/canvas/task-editor/execution-rule";

import {
  useExecutionRules,
  useCreateExecutionRule,
  useUpdateExecutionRule,
  useDeleteExecutionRule,
} from "@/features/onboarding-template/services";

export function ExecutionRuleSection() {

  /**
   * TODO
   *
   * Replace with the selected Execution Profile.
   * For now this is a placeholder until the
   * profile selection workflow is implemented.
   */
  const executionProfileId = "";

  const {
    data: rows = [],
    isLoading,
  } = useExecutionRules(
    executionProfileId,
  );

  const createRule =
    useCreateExecutionRule();

  const updateRule =
    useUpdateExecutionRule();

  const deleteRule =
    useDeleteExecutionRule();

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [selectedRule, setSelectedRule] =
    useState<ExecutionRuleRow>();

  async function handleSave(
    value: ExecutionRuleRow,
  ) {

    if (value.id) {

      await updateRule.mutateAsync({

        id: value.id,

        dto: value,

      });

    } else {

      await createRule.mutateAsync(
        value,
      );

    }

  }

  function handleDelete(
    row: ExecutionRuleRow,
  ) {

    deleteRule.mutate(
      row.id,
    );

  }

  return (

    <div className="space-y-6">

      <ExecutionRuleToolbar

        onAdd={() => {

          setSelectedRule(
            undefined,
          );

          setDialogOpen(true);

        }}

      />

      <ExecutionRuleTable

        rows={rows}

        loading={isLoading}

        onEdit={row => {

          setSelectedRule(
            row,
          );

          setDialogOpen(true);

        }}

        onDelete={handleDelete}

      />

      <ExecutionRuleDialog

        open={dialogOpen}

        executionRule={
          selectedRule
        }

        onOpenChange={
          setDialogOpen
        }

        onSave={handleSave}

      />

    </div>

  );

}