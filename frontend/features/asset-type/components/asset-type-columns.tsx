"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { ASSET_KIND_LABELS } from "@/features/asset/lib/kind-tracking";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { AssetTypeActions } from "./asset-type-actions";
import type { AssetType } from "../types/asset-type";

interface AssetTypeColumnOptions {
  onEdit?: (assetType: AssetType) => void;
}

export const assetTypeColumns = (
  options: AssetTypeColumnOptions = {},
): ColumnDef<AssetType>[] => [
  {
    id: "company",
    accessorFn: (row) => row.company?.companyName ?? row.company?.name ?? "",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Company
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) =>
      row.original.company?.companyName ?? row.original.company?.name ?? "-",
  },
  {
    id: "assetCategory",
    accessorFn: (row) => row.assetCategory?.assetCategoryName ?? "",
    header: "Category",
    cell: ({ row }) => row.original.assetCategory?.assetCategoryName ?? "-",
  },
  {
    accessorKey: "assetTypeCode",
    header: "Type Code",
  },
  {
    accessorKey: "assetTypeName",
    header: "Type Name",
  },
  {
    id: "kind",
    accessorFn: (row) => row.kind,
    header: "Kind",
    cell: ({ row }) => ASSET_KIND_LABELS[row.original.kind] ?? row.original.kind,
  },
  {
    accessorKey: "trackingMode",
    header: "Tracking",
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.isActive ? "Active" : "Archived"}
        tone={row.original.isActive ? "success" : "neutral"}
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) =>
      hasAllowedAction(row.original.allowedActions, "EDIT") ? (
        <AssetTypeActions assetType={row.original} onEdit={options.onEdit} />
      ) : null,
  },
];
