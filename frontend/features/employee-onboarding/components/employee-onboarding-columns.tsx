"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/features/employee/components/employee-avatar";

import { OnboardingStatusBadge } from "./employee-onboarding-status-badge";
import { OnboardingProgress } from "./employee-onboarding-progress";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

export const onboardingColumns =
(): ColumnDef<EmployeeOnboarding>[] => [
  {
    id: "employee",

    accessorFn: (row) =>
      `${row.employee?.firstName ?? ""} ${row.employee?.lastName ?? ""}`.trim(),

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Employee
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),

    cell: ({ row }) => (
      <EmployeeAvatar
        employee={row.original.employee}
      />
    ),
  },

  {
    accessorKey: "template.templateName",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Template
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),

    cell: ({ row }) =>
      row.original.template?.templateName ?? "-",
  },

  {
    accessorKey: "status",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),

    cell: ({ row }) => (
      <OnboardingStatusBadge
        status={row.original.status}
      />
    ),
  },

  {
    id: "progress",

    header: "Progress",

    cell: ({ row }) => {
      const tasks = row.original.tasks ?? [];
      const completedFromTasks = tasks.filter(
        (task) => task.status === "COMPLETED",
      ).length;
      const progress = (
        row.original as EmployeeOnboarding & {
          progress?: { terminal?: number | null; total?: number | null };
        }
      ).progress;
      const completed = tasks.length > 0 ? completedFromTasks : progress?.terminal ?? 0;
      const total = tasks.length > 0 ? tasks.length : progress?.total ?? 0;

      return (
        <div className="w-44 space-y-2">
          <OnboardingProgress
            completed={completed}
            total={total}
          />

          <div className="text-xs text-muted-foreground">
            {completed} / {total} completed
          </div>
        </div>
      );
    },
  },

  {
    accessorKey: "startDate",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Start Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "completedDate",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Completed
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),

    cell: ({ row }) =>
      row.original.completedDate ?? "-",
  },
];