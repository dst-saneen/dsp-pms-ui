"use client";

import { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";

import type { LeaveRequest } from "../types/leave-request";

function employeeLabel(row: LeaveRequest) {
  const name = [row.employee?.firstName, row.employee?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || row.employee?.employeeCode || row.employeeId;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ProcessMode = "approve" | "reject" | "cancel";

export const leaveRequestColumns = (
  onProcess: (request: LeaveRequest, mode: ProcessMode) => void,
): ColumnDef<LeaveRequest>[] => [
  {
    id: "employee",
    header: "Employee",
    cell: ({ row }) => employeeLabel(row.original),
  },
  {
    id: "leaveType",
    header: "Leave type",
    cell: ({ row }) => row.original.leaveType?.leaveName ?? "—",
  },
  {
    id: "dates",
    header: "Dates",
    cell: ({ row }) =>
      `${formatDate(row.original.fromDate)} – ${formatDate(row.original.toDate)}`,
  },
  {
    accessorKey: "requestedDays",
    header: "Days",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.approvalProgress?.currentStepName ?? row.original.status}
        tone="neutral"
      />
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const canDecide = Boolean(row.original.approvalProgress?.canAct);
      const canReview = Boolean(row.original.approvalProgress);

      return (
        <div className="flex flex-wrap gap-1">
          {canDecide ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onProcess(row.original, "approve");
                }}
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onProcess(row.original, "reject");
                }}
              >
                Reject
              </Button>
            </>
          ) : canReview ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onProcess(row.original, "approve");
              }}
            >
              View
            </Button>
          ) : null}
        </div>
      );
    },
  },
];
