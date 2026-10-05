"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { ASSET_KIND_LABELS } from "../lib/kind-tracking";
import { AssetActions } from "./asset-actions";
import type { Asset } from "../types/asset";

interface AssetColumnOptions {
  onEdit?: (asset: Asset) => void;
  onAssign?: (asset: Asset) => void;
}

export const assetColumns = (
  options: AssetColumnOptions = {},
): ColumnDef<Asset>[] => [
  {
    id: "department",
    accessorFn: (row) =>
      row.department?.departmentName ?? row.department?.name ?? "",
    header: "Department",
    cell: ({ row }) =>
      row.original.department?.departmentName ??
      row.original.department?.name ??
      "-",
  },
  {
    id: "kind",
    accessorFn: (row) => row.kind,
    header: "Kind",
    cell: ({ row }) => ASSET_KIND_LABELS[row.original.kind] ?? row.original.kind,
  },
  {
    id: "type",
    accessorFn: (row) => row.assetType?.assetTypeName ?? "",
    header: "Type",
    cell: ({ row }) => row.original.assetType?.assetTypeName ?? "-",
  },
  {
    accessorKey: "assetCode",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Asset Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "assetName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Asset Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    id: "identifier",
    header: "Identifier",
    cell: ({ row }) => {
      if (row.original.kind === "CARD") {
        return "••••";
      }
      if (row.original.kind === "SOFTWARE_LICENSE") {
        return "Pool";
      }
      return row.original.serialNumber || row.original.location || "-";
    },
  },
  {
    accessorKey: "lifecycleStatus",
    header: "Lifecycle",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.lifecycleStatus || row.original.status}
        tone={row.original.isActive ? "success" : "neutral"}
      />
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <AssetActions
        asset={row.original}
        onEdit={options.onEdit}
        onAssign={options.onAssign}
      />
    ),
  },
];
