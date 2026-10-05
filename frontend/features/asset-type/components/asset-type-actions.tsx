"use client";

import { RowActions } from "@/components/tables/row-actions";

import type { AssetType } from "../types/asset-type";

interface AssetTypeActionsProps {
  assetType: AssetType;
  onEdit?: (assetType: AssetType) => void;
}

export function AssetTypeActions({
  assetType,
  onEdit,
}: AssetTypeActionsProps) {
  return <RowActions onEdit={() => onEdit?.(assetType)} />;
}
