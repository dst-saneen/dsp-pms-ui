"use client";

import { DataTable } from "@/components/tables/data-table";

import { assetColumns } from "./asset-columns";
import type { Asset } from "../types/asset";

interface AssetTableProps {
  data: Asset[];
  onEdit?: (asset: Asset) => void;
  onAssign?: (asset: Asset) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function AssetTable({
  data,
  onEdit,
  onAssign,
  isLoading,
  error,
  onRetry,
}: AssetTableProps) {
  return (
    <DataTable
      columns={assetColumns({ onEdit, onAssign })}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No physical assets found"
      emptyDescription="Add a laptop, card, or other physical item. Software licences are created on the Licences page."
      onRowClick={(asset) => {
        if (asset.allowedActions?.includes("UPDATE_METADATA")) {
          onEdit?.(asset);
        }
      }}
      getRowLabel={(asset) => `Open ${asset.assetName}`}
    />
  );
}
