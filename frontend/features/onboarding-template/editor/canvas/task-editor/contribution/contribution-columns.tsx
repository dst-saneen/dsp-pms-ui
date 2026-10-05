"use client";

import type {
  ColumnDef,
} from "@tanstack/react-table";

import {
  ArrowUpDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  RowActions,
} from "@/components/tables";

import type {
  TaskContribution,
} from "@/features/onboarding-contribution/services/task-contribution.service";

interface ContributionColumnsProps {

  onRemove?(
    row: TaskContribution,
  ): void;

}

export function contributionColumns({
  onRemove,
}: ContributionColumnsProps): ColumnDef<TaskContribution>[] {

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

      accessorFn: row =>
        row.isRequired,

      id: "required",

      header: "Required",

      cell: ({ row }) =>

        row.original.isRequired
          ? "Yes"
          : "No",

    },

    {

      accessorFn: row =>
        row.contribution.contributionCode,

      id: "code",

      header: "Code",

    },

    {

      accessorFn: row =>
        row.contribution.contributionName,

      id: "name",

      header: "Contribution",

    },

    {

      accessorFn: row =>
        row.contribution.description,

      id: "description",

      header: "Description",

      cell: ({ row }) =>

        row.original.contribution.description ??
        "-",

    },

    {

      id: "actions",

      enableSorting: false,

      cell: ({ row }) => (

        <RowActions

          onDelete={
            onRemove
              ? () =>
                  onRemove(
                    row.original,
                  )
              : undefined
          }

        />

      ),

    },

  ];

}