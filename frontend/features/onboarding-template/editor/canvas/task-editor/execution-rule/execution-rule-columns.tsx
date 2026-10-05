"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/tables";

export interface ExecutionRuleRow {
  id: string;

  executionProfileId: string;

  sequenceNo: number;

  ownerType: string;

  executionType: string;

  action: string;

  workType: string;

  approvalWorkflowId?: string;

  dueDays?: number;

  reminderIntervalDays?: number;

  estimatedDurationMinutes?: number;

  conditionExpression?: string;

  autoComplete: boolean;

  allowReopen: boolean;

  isActive: boolean;
}

interface ExecutionRuleColumnsProps {
  onEdit?(row: ExecutionRuleRow): void;
  onDelete?(row: ExecutionRuleRow): void;
}

export function executionRuleColumns({
  onEdit,
  onDelete,
}: ExecutionRuleColumnsProps): ColumnDef<ExecutionRuleRow>[] {
  return [
    {
      accessorKey: "sequenceNo",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() =>
            column.toggleSorting(
              column.getIsSorted() === "asc",
            )
          }
        >
          Seq
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },

    {
      accessorKey: "ownerType",
      header: "Owner",
    },

    {
      accessorKey: "executionType",
      header: "Execution",
    },

    {
      accessorKey: "action",
      header: "Action",
    },

    {
      accessorKey: "workType",
      header: "Work Type",
    },

    {
      accessorKey: "dueDays",
      header: "Due",
      cell: ({ row }) =>
        row.original.dueDays ?? "-",
    },

    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) =>
        row.original.isActive
          ? "Yes"
          : "No",
    },

    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          onEdit={
            onEdit
              ? () => onEdit(row.original)
              : undefined
          }
          onDelete={
            onDelete
              ? () => onDelete(row.original)
              : undefined
          }
        />
      ),
    },
  ];
}