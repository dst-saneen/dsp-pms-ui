"use client";

import type { ColumnDef } from "@tanstack/react-table";

export interface TaskColumnRow {
  id?: string;
  sequenceNo?: number;
  taskName?: string;
  ownerType?: string | null;
  assignedDepartmentName?: string | null;
  dueOffset?: number | null;
  priority?: number;
  mandatory?: boolean;
  status?: string;
}

export function taskColumns(): ColumnDef<TaskColumnRow>[] {
  return [
    {
      accessorKey: "sequenceNo",
      header: "Seq",
      size: 60,
    },
    {
      accessorKey: "taskName",
      header: "Onboarding Task",
    },
    {
      accessorKey: "ownerType",
      header: "Assigned To",
      cell: ({ row }) => {
        const value = row.original.ownerType;

        switch (value) {
          case "DEPARTMENT":
            return "Department";

          case "EMPLOYEE":
            return "Employee";

          case "SYSTEM":
            return "System";

          default:
            return "-";
        }
      },
    },
    {
      accessorKey: "assignedDepartmentName",
      header: "Department",
      cell: ({ row }) =>
        row.original.ownerType === "DEPARTMENT"
          ? row.original.assignedDepartmentName ?? "-"
          : "-",
    },
    {
      accessorKey: "dueOffset",
      header: "Due",
      cell: ({ getValue }) => {
        const value = getValue<number>();

        if (value == null) {
          return "-";
        }

        return `D${value}`;
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
    },
    {
      accessorKey: "mandatory",
      header: "Required",
      cell: ({ getValue }) =>
        getValue<boolean>() ? "Yes" : "No",
    },
    {
      accessorKey: "status",
      header: "Status",
    },
  ];
}
