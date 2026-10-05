"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";

import type { Company } from "../types/company";

export const companyColumns = (): ColumnDef<Company>[] => [
  {
    accessorKey: "companyCode",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Company Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "companyName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Company Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    id: "companyGroup",
    accessorFn: (row) =>
      row.companyGroup?.groupName ?? "",
    header: "Company Group",
    cell: ({ row }) =>
      row.original.companyGroup?.groupName ?? "-",
  },

  {
    id: "parentCompany",
    accessorFn: (row) =>
      row.parentCompany?.companyName ?? "",
    header: "Parent Company",
    cell: ({ row }) =>
      row.original.parentCompany?.companyName ?? "-",
  },

  {
    accessorKey: "registrationNo",
    header: "Registration No",
    cell: ({ row }) =>
      row.original.registrationNo ?? "-",
  },

  {
    accessorKey: "taxNumber",
    header: "Tax Number",
    cell: ({ row }) =>
      row.original.taxNumber ?? "-",
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
];
