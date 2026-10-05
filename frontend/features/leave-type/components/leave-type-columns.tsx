"use client";

import { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";

import type { LeaveType } from "../types/leave-type";
import { leaveTypeCategoryLabel } from "../validation/leave-type-schema";

export const leaveTypeColumns = (options?: { showCompany?: boolean }): ColumnDef<LeaveType>[] => {
  const columns: ColumnDef<LeaveType>[] = [];

  if (options?.showCompany !== false) {
    columns.push({
      id: "company",
      accessorFn: (row) => row.company?.companyName ?? "",
      header: "Company",
      cell: ({ row }) => row.original.company?.companyName ?? "—",
    });
  }

  columns.push(
    {
      accessorKey: "leaveCode",
      header: "Code",
    },
    {
      accessorKey: "leaveName",
      header: "Name",
    },
    {
      id: "category",
      header: "Kind",
      cell: ({ row }) => (
        <StatusBadge
          label={leaveTypeCategoryLabel(row.original.category)}
          tone={
            row.original.category === "COMP_OFF"
              ? "information"
              : row.original.category === "UNPAID"
                ? "warning"
                : row.original.category === "OPTIONAL_HOLIDAY"
                  ? "progress"
                  : "neutral"
          }
        />
      ),
    },
    {
      accessorKey: "isPaid",
      header: "Paid",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isPaid ? "Paid" : "Unpaid"}
          tone={row.original.isPaid ? "success" : "neutral"}
        />
      ),
    },
    {
      accessorKey: "requiresApproval",
      header: "Approval",
      cell: ({ row }) => (row.original.requiresApproval ? "Required" : "Auto"),
    },
    {
      accessorKey: "allowHalfDay",
      header: "Half day",
      cell: ({ row }) => (row.original.allowHalfDay ? "Yes" : "No"),
    }
  );

  return columns;
};
