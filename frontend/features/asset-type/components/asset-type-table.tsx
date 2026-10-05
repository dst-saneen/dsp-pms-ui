"use client";

import { DataTable } from "@/components/tables/data-table";

import { assetTypeColumns } from "./asset-type-columns";
import type { AssetType } from "../types/asset-type";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";

interface AssetTypeTableProps {
  data: AssetType[];
  onEdit?: (assetType: AssetType) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function AssetTypeTable({
  data,
  onEdit,
  isLoading,
  error,
  onRetry,
}: AssetTypeTableProps) {
  return (
    <DataTable
      columns={assetTypeColumns({ onEdit })}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No asset types found"
      emptyDescription="Create an asset type or adjust the current search."
      onRowClick={(assetType) => {
        if (hasAllowedAction(assetType.allowedActions, "EDIT")) {
          onEdit?.(assetType);
        }
      }}
      getRowLabel={(assetType) => `Open ${assetType.assetTypeName}`}
    />
  );
}
