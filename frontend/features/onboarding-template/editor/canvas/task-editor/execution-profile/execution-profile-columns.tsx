"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/tables";

export interface ExecutionProfileRow {
  id: string;

  contributionId: string;

  displayOrder: number;

  profileCode?: string;

  profileName: string;

  description?: string;

  isDefault: boolean;
}

interface ExecutionProfileColumnsProps {
  onEdit?(row: ExecutionProfileRow): void;
  onDelete?(row: ExecutionProfileRow): void;
}

export function executionProfileColumns({
  onEdit,
  onDelete,
}: ExecutionProfileColumnsProps): ColumnDef<ExecutionProfileRow>[] {
  return [
    {
      accessorKey: "displayOrder",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() =>
            column.toggleSorting(
              column.getIsSorted() === "asc",
            )
          }
        >
          Order
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },

    {
      accessorKey: "profileCode",
      header: "Code",
      cell: ({ row }) =>
        row.original.profileCode ?? "-",
    },

    {
      accessorKey: "profileName",
      header: "Profile",
    },

    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) =>
        row.original.description ?? "-",
    },

    {
      accessorKey: "isDefault",
      header: "Default",
      cell: ({ row }) =>
        row.original.isDefault ? "Yes" : "No",
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