"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import { EmployeeDocumentTypeActions } from "./employee-document-type-actions";

export const employeeDocumentTypeColumns = (
  onEdit?: (documentType: EmployeeDocumentType) => void,
  onDelete?: (documentType: EmployeeDocumentType) => void,
): ColumnDef<EmployeeDocumentType>[] => [
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
      row.original.company?.companyName ?? "-",
  },

  {
    id: "category",
    accessorFn: (row) =>
      row.category?.categoryName ?? "",

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

    cell: ({ row }) =>
      row.original.category?.categoryName ?? "-",
  },

  {
    accessorKey: "documentCode",

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
    accessorKey: "documentName",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Document Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "isMandatory",

    header: "Mandatory",

    cell: ({ row }) => (
      <StatusBadge
        label={row.original.isMandatory ? "Mandatory" : "Optional"}
        tone={row.original.isMandatory ? "accent" : "neutral"}
      />
    ),
  },

  {
    accessorKey: "isActive",

    header: "Status",

    cell: ({ row }) => (
      <StatusBadge
        label={row.original.isActive ? "Active" : "Inactive"}
        tone={row.original.isActive ? "success" : "neutral"}
      />
    ),
  },

  {
    id: "actions",

    header: "Actions",

    enableSorting: false,

    cell: ({ row }) => (
      <EmployeeDocumentTypeActions
        documentType={row.original}
        onDelete={onDelete}
      />
    ),
  },
];
