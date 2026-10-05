"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Shift } from "../types/shift";

export const shiftColumns = (): ColumnDef<Shift>[] => [
  {
    id: "company",
    accessorFn: (row) => row.company?.companyName ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Company
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.company?.companyName ?? "-",
  },

  {
    accessorKey: "shiftCode",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Shift Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "shiftName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Shift Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "startTime",
    header: "Start",
  },

  {
    accessorKey: "endTime",
    header: "End",
  },

  {
    accessorKey: "breakMinutes",
    header: "Break",
  },

  {
    accessorKey: "graceInMinutes",
    header: "Grace In",
  },

  {
    accessorKey: "graceOutMinutes",
    header: "Grace Out",
  },

  {
    accessorKey: "isNightShift",
    header: "Night",
    cell: ({ row }) =>
      row.original.isNightShift
        ? "Yes"
        : "No",
  },

  {
    accessorKey: "isDefault",
    header: "Default",
    cell: ({ row }) =>
      row.original.isDefault
        ? "Yes"
        : "No",
  },

  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      row.original.isActive
        ? "Active"
        : "Inactive",
  },
];