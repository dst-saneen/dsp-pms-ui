"use client";

import { DataTable } from "@/components/tables";

import {
  executionRuleColumns,
  type ExecutionRuleRow,
} from "./execution-rule-columns";

import { ExecutionRuleEmpty } from "./execution-rule-empty";

interface ExecutionRuleTableProps {
  rows: ExecutionRuleRow[];

  loading?: boolean;

  onEdit?(
    row: ExecutionRuleRow,
  ): void;

  onDelete?(
    row: ExecutionRuleRow,
  ): void;
}

export function ExecutionRuleTable({
  rows,
  loading,
  onEdit,
  onDelete,
}: ExecutionRuleTableProps) {

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading execution rules...
      </div>
    );
  }

  if (rows.length === 0) {
    return <ExecutionRuleEmpty />;
  }

  return (
    <DataTable
      columns={executionRuleColumns({
        onEdit,
        onDelete,
      })}
      data={rows}
    />
  );
}