"use client";

import { RowActions } from "@/components/tables/row-actions";

import type { AssetCategory } from "../types/asset-category";

interface AssetCategoryActionsProps {
  assetCategory: AssetCategory;
  onEdit?: (category: AssetCategory) => void;
}

export function AssetCategoryActions({
  assetCategory,
  onEdit,
}: AssetCategoryActionsProps) {
  return <RowActions onEdit={() => onEdit?.(assetCategory)} />;
}
