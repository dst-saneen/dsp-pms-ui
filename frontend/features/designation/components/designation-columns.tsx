"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";

import {
  getDesignationOnboardingDepartments,
  type Designation,
} from "../types/designation";

export const designationColumns = (): ColumnDef<Designation>[] => [
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
    accessorKey: "designationCode",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Designation Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    accessorKey: "designationName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Designation Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },

  {
    id: "department",
    accessorFn: (row) =>
      row.department
        ? `${row.department.departmentName}${
            row.department.branch
              ? ` (${row.department.branch.branchCode})`
              : ""
          }`
        : "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Department
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const department = row.original.department;
      if (!department) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <div className="space-y-0.5">
          <div>{department.departmentName}</div>
          {department.branch ? (
            <div className="text-muted-foreground text-xs">
              {department.branch.branchCode} — {department.branch.branchName}
            </div>
          ) : null}
        </div>
      );
    },
  },

  {
    id: "onboardingDepartments",
    accessorFn: (row) =>
      getDesignationOnboardingDepartments(row)
        .map(
          (entry) =>
            entry.department?.departmentName ?? entry.departmentId,
        )
        .join(", "),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Onboarding Departments
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const departments = getDesignationOnboardingDepartments(row.original);
      if (departments.length === 0) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <div className="flex max-w-xs flex-wrap gap-1">
          {departments.map((entry) => (
            <StatusBadge
              key={entry.id}
              label={
                entry.department?.departmentName ??
                entry.department?.departmentCode ??
                "Department"
              }
              tone="neutral"
            />
          ))}
        </div>
      );
    },
  },

  {
    accessorKey: "level",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
          )
        }
      >
        Level
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.level ?? "-",
  },

  {
    accessorKey: "isActive",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(
            column.getIsSorted() === "asc"
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
];
