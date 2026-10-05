"use client";

import { format } from "date-fns";

import { DataTable } from "@/components/tables/data-table";
import { getApiErrorMessage } from "@/services/api-client";
import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";

import { useEmployeeAssets } from "../hooks/use-employee-assets";
import type { EmployeeAsset } from "../types";

function employeeLabel(assignment: EmployeeAsset) {
  const employee = assignment.employee;
  if (!employee) {
    return assignment.employeeId?.slice(0, 8) ?? "-";
  }
  return (
    employee.name ||
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() ||
    employee.employeeCode ||
    employee.code ||
    "-"
  );
}

const columns = (): ColumnDef<EmployeeAsset>[] => [
  {
    accessorKey: "asset.assetCode",
    header: "Asset Code",
    cell: ({ row }) => row.original.asset?.assetCode ?? "-",
  },
  {
    accessorKey: "asset.assetName",
    header: "Asset",
    cell: ({ row }) => row.original.asset?.assetName ?? "-",
  },
  {
    id: "employee",
    header: "Employee",
    cell: ({ row }) => employeeLabel(row.original),
  },
  {
    accessorKey: "custodyStatus",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.custodyStatus || row.original.status || "—"}
        tone="neutral"
      />
    ),
  },
  {
    accessorKey: "assignedDate",
    header: "Assigned",
    cell: ({ row }) =>
      format(new Date(row.original.assignedDate), "dd MMM yyyy"),
  },
];

export function EmployeeAssetTable() {
  const { data = [], isLoading, error, refetch } = useEmployeeAssets();

  return (
    <DataTable
      columns={columns()}
      data={data}
      isLoading={isLoading}
      error={
        error
          ? getApiErrorMessage(
              error,
              "We could not load employee asset assignments.",
            )
          : null
      }
      onRetry={() => {
        void refetch();
      }}
      emptyTitle="No physical assignments"
      emptyDescription="Assign a laptop, card, or other item. Licence seats are allocated on the Licences page."
    />
  );
}
