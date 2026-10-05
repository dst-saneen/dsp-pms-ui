"use client";

import { DataTable } from "@/components/tables/data-table";

import { assetCategoryColumns } from "./asset-category-columns";
import type { AssetCategory } from "../types/asset-category";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";

interface AssetCategoryTableProps {
  data: AssetCategory[];
  onEdit?: (category: AssetCategory) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function AssetCategoryTable({
  data,
  onEdit,
  isLoading,
  error,
  onRetry,
}: AssetCategoryTableProps) {
  return (
    <DataTable
      columns={assetCategoryColumns({ onEdit })}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No asset categories found"
      emptyDescription="Create an asset category or adjust the current search."
      onRowClick={(category) => {
        if (hasAllowedAction(category.allowedActions, "EDIT")) {
          onEdit?.(category);
        }
      }}
      getRowLabel={(category) => `Open ${category.assetCategoryName}`}
    />
  );
}
