"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MalwareScanStatus } from "@/components/file-upload/malware-scan-status";
import { EmployeeDocumentVerificationBadge } from "./employee-document-verification-badge";
import { employeeDocumentDetailHref } from "../lib/employee-document-navigation";

import type { EmployeeDocument } from "../types/employee-document";

export const employeeDocumentColumns = (options?: {
  returnTo?: string;
}): ColumnDef<EmployeeDocument>[] => [
  {
    id: "employee",
    accessorFn: (row) =>
      row.employee
        ? `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName ?? ""}`
        : "",
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
    cell: ({ row }) =>
      row.original.employee
        ? `${row.original.employee.employeeCode} - ${row.original.employee.firstName} ${row.original.employee.lastName ?? ""}`
        : "-",
  },

  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Document
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={employeeDocumentDetailHref(row.original.id, {
          returnTo: options?.returnTo,
        })}
        className="font-medium underline-offset-4 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {row.original.title}
      </Link>
    ),
  },

  {
    id: "documentType",
    accessorFn: (row) =>
      row.documentType?.documentName ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.documentType?.documentName ?? "-",
  },

  {
    accessorKey: "documentNumber",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Number
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.documentNumber ?? "-",
  },

  {
    accessorKey: "expiryDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Expiry
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      if (row.original.lifetimeDocument) {
        return "Lifetime";
      }

      return row.original.expiryDate
        ? new Date(
            row.original.expiryDate,
          ).toLocaleDateString()
        : "-";
    },
  },

  {
    id: "fileStatus",
    accessorFn: (row) => row.fileStatus ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Scan
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.fileStatus ? (
        <MalwareScanStatus
          status={row.original.fileStatus}
          className="scale-90"
        />
      ) : (
        <span className="text-muted-foreground text-xs">No file</span>
      ),
  },

  {
    accessorKey: "verificationStatus",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc",
          )
        }
      >
        Verification
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <EmployeeDocumentVerificationBadge
            status={row.original.verificationStatus}
        />
    ),
  },
];
