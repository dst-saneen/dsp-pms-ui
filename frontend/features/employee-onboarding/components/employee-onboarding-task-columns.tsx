"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import { OnboardingStatusBadge } from "./employee-onboarding-status-badge";

import type { EmployeeOnboardingTask } from "../types/employee-onboarding-task";

export const onboardingTaskColumns =
(): ColumnDef<EmployeeOnboardingTask>[] => [
  {
    accessorKey: "sequenceNo",

    header: "#",
  },

  {
    accessorKey: "taskName",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Task
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "workType",

    header: "Work Type",
  },

  {
    accessorKey: "isMandatory",

    header: "Mandatory",

    cell: ({ row }) =>
      row.original.isMandatory ? "Yes" : "No",
  },

  {
    accessorKey: "status",

    header: "Status",

    cell: ({ row }) => (
      <OnboardingStatusBadge
        status={row.original.status}
      />
    ),
  },

  {
    accessorKey: "startedDate",

    header: "Started",

    cell: ({ row }) =>
      row.original.startedDate ?? "-",
  },

  {
    accessorKey: "dueDate",

    header: "Due",

    cell: ({ row }) =>
      row.original.dueDate ?? "-",
  },

  {
    accessorKey: "completedDate",

    header: "Completed",

    cell: ({ row }) =>
      row.original.completedDate ?? "-",
  },
];