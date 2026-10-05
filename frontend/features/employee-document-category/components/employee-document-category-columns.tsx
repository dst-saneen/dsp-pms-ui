"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import { StatusBadge } from "@/components/common/status-badge";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import { EmployeeDocumentCategoryActions } from "./employee-document-category-actions";

export const employeeDocumentCategoryColumns = (
  onDelete?: (
    category: EmployeeDocumentCategory,
  ) => void,
): ColumnDef<EmployeeDocumentCategory>[] => [
  {
    id: "company",
    accessorFn: (row) =>
      row.company?.companyName ?? "",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Company
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),

    cell: ({ row }) =>
      row.original.company?.companyName ??
      "-",
  },

  {
    accessorKey: "categoryCode",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "categoryName",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Category
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "sortOrder",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Sort
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "isActive",

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
      <StatusBadge
        label={row.original.isActive ? "Active" : "Inactive"}
        tone={row.original.isActive ? "success" : "neutral"}
      />
    ),
  },

  {
    id: "actions",

    header: "",

    enableSorting: false,

    cell: ({ row }) => (
      <EmployeeDocumentCategoryActions
        category={row.original}
        onDelete={onDelete}
      />
    ),
  },
];
