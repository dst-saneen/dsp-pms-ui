"use client";

import { useMemo } from "react";
import { format } from "date-fns";

import type { ColumnDef } from "@tanstack/react-table";

import { InfoCard } from "@/components/common";
import { DataTable } from "@/components/tables";

import type { EmployeeLeaveHistory } from "../types";

interface LeaveHistoryProps {
  history: EmployeeLeaveHistory[];
}

export function LeaveHistory({
  history,
}: LeaveHistoryProps) {
  const columns = useMemo<
    ColumnDef<EmployeeLeaveHistory>[]
  >(
    () => [
      {
        accessorKey: "leaveType",
        header: "Leave Type",
      },
      {
        accessorKey: "fromDate",
        header: "From",
        cell: ({ row }) =>
          format(
            new Date(row.original.fromDate),
            "dd MMM yyyy",
          ),
      },
      {
        accessorKey: "toDate",
        header: "To",
        cell: ({ row }) =>
          format(
            new Date(row.original.toDate),
            "dd MMM yyyy",
          ),
      },
      {
        accessorKey: "requestedDays",
        header: "Requested",
      },
      {
        accessorKey: "approvedDays",
        header: "Approved",
        cell: ({ row }) =>
          row.original.approvedDays ?? "-",
      },
      {
        accessorKey: "status",
        header: "Status",
      },
    ],
    [],
  );

  return (
    <InfoCard title="Leave History">
      <DataTable
        columns={columns}
        data={history}
      />
    </InfoCard>
  );
}