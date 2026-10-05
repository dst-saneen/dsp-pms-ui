"use client";

import { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";

import type { LeavePolicy } from "../types/leave-policy";
import { formatAnnualEntitlement } from "../lib/leave-entitlement";

export const leavePolicyColumns = (): ColumnDef<LeavePolicy>[] => [
  {
    id: "leaveType",
    accessorFn: (row) => row.leaveType?.leaveName ?? "",
    header: "Leave type",
    cell: ({ row }) =>
      row.original.leaveType
        ? `${row.original.leaveType.leaveName} (${row.original.leaveType.leaveCode})`
        : "—",
  },
  {
    id: "scope",
    header: "Scope",
    cell: ({ row }) => {
      const item = row.original;
      if (!item.branchId) {
        return "Company default";
      }
      const parts = [
        item.branch?.branchName,
        item.department?.departmentName,
        item.designation?.designationName,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : (item.company?.companyName ?? "—");
    },
  },
  {
    id: "annualEntitlement",
    header: "Days / year",
    cell: ({ row }) => formatAnnualEntitlement(row.original.annualEntitlement) || "—",
  },
  {
    accessorKey: "carryForwardLimit",
    header: "Carry forward",
    cell: ({ row }) => row.original.carryForwardLimit ?? "—",
  },
  {
    accessorKey: "allowNegativeBalance",
    header: "Balance below zero",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.allowNegativeBalance ? "Allowed" : "Not allowed"}
        tone={row.original.allowNegativeBalance ? "warning" : "neutral"}
      />
    ),
  },
];
