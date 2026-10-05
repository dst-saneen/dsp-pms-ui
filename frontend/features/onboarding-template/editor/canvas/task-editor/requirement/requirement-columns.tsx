"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/tables";

export interface RequirementRow {
  id: string;

  displayOrder: number;

  requirementCode?: string;

  requirementName: string;

  requirementType: string;

  isMandatory: boolean;

  defaultValue?: string;
}

interface Props {
  onEdit?(row: RequirementRow): void;

  onDelete?(row: RequirementRow): void;
}

export function requirementColumns({
  onEdit,
  onDelete,
}: Props): ColumnDef<RequirementRow>[] {
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
      accessorKey: "requirementCode",
      header: "Code",
      cell: ({ row }) =>
        row.original.requirementCode ?? "-",
    },

    {
      accessorKey: "requirementName",
      header: "Requirement",
    },

    {
      accessorKey: "requirementType",
      header: "Type",
    },

    {
      accessorKey: "isMandatory",
      header: "Mandatory",
      cell: ({ row }) =>
        row.original.isMandatory ? "Yes" : "No",
    },

    {
      accessorKey: "defaultValue",
      header: "Default",
      cell: ({ row }) =>
        row.original.defaultValue ?? "-",
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