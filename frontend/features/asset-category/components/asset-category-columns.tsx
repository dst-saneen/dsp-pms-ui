"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { AssetCategoryActions } from "./asset-category-actions";
import type { AssetCategory } from "../types/asset-category";

interface AssetCategoryColumnOptions {
  onEdit?: (category: AssetCategory) => void;
}

export const assetCategoryColumns = (
  options: AssetCategoryColumnOptions = {},
): ColumnDef<AssetCategory>[] => [
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
    accessorKey: "assetCategoryCode",
    header: "Code",
  },
  {
    accessorKey: "assetCategoryName",
    header: "Category",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "-",
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
        <AssetCategoryActions
          assetCategory={row.original}
          onEdit={options.onEdit}
        />
      ) : null,
  },
];
