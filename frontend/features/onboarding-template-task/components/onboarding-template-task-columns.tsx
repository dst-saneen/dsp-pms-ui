"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  OnboardingTemplateTaskStatusBadge,
} from "./onboarding-template-task-status-badge";

import type {
  OnboardingTemplateTask,
} from "../types";

export const onboardingTemplateTaskColumns =
(): ColumnDef<OnboardingTemplateTask>[] => [
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
    accessorKey: "description",

    header: "Description",

    cell: ({ row }) =>
      row.original.description ??
      "-",
  },

  {
    accessorKey: "isMandatory",

    header: "Mandatory",

    cell: ({ row }) => (
      <OnboardingTemplateTaskStatusBadge
        mandatory={
          row.original
            .isMandatory
        }
      />
    ),
  },
];