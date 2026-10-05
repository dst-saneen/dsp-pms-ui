"use client";

import { ColumnDef } from "@tanstack/react-table";

import { EmployeeStatusBadge } from "./employee-status-badge";
import type { Employee } from "../types/employee";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "./employee-avatar";

export const employeeColumns = (): ColumnDef<Employee>[] => [
  {
    accessorKey: "employeeCode",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    id: "employee",
    accessorFn: (row) =>
      `${row.firstName} ${row.lastName}`,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Employee
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <EmployeeAvatar
        employee={row.original}
      />
    ),
  },
  {
    id: "department",
    accessorFn: (row) => row.department?.departmentName ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Department
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.department?.departmentName ?? "-",
  },
  {
    id: "designation",
    accessorFn: (row) => row.designation?.designationName ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Designation
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.designation?.designationName ?? "-",
  },
  {
    id: "manager",
    accessorFn: (row) =>
      row.manager
        ? `${row.manager.firstName} ${row.manager.lastName}`
        : "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Manager
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.manager
        ? `${row.original.manager.firstName} ${row.original.manager.lastName}`
        : "-",
  },
  {
  accessorKey: "employmentStatus",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <EmployeeStatusBadge
        status={row.original.employmentStatus}
      />
    ),
  },
  
  
];