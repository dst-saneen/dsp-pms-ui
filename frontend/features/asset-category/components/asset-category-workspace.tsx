"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Folder, PauseCircle } from "lucide-react";

import { AssetCategoryToolbar } from "./asset-category-toolbar";
import { AssetCategoryTable } from "./asset-category-table";
import { AssetCategoryDialog } from "../dialogs/asset-category-dialog";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { useAssetCategories } from "../hooks/use-asset-categories";
import type { AssetCategory } from "../types/asset-category";

export function AssetCategoryWorkspace() {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<AssetCategory | null>(null);
  const [search, setSearch] = useState("");
  const { data, refetch, isFetching, isLoading, error } = useAssetCategories({
    keyword: search.trim() || undefined,
  });
  const categories = data?.items ?? [];
  const canCreate = hasPermission("assets.assets.manage");

  const handleCreate = () => {
    setSelectedCategory(null);
    setOpen(true);
  };

  const handleEdit = (category: AssetCategory) => {
    if (!hasAllowedAction(category.allowedActions, "EDIT")) {
      return;
    }
    setSelectedCategory(category);
    setOpen(true);
  };

  return (
    <WorkspaceShell>
      <KpiGrid columns={4}>
        <KpiCard
          title="Total Categories"
          value={isLoading ? "—" : data?.total ?? categories.length}
          icon={Folder}
          helperText="Available asset groupings"
          density="compact"
        />
        <KpiCard
          title="Active"
          value={isLoading ? "—" : categories.filter((x) => x.isActive).length}
          icon={CheckCircle2}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Archived"
          value={isLoading ? "—" : categories.filter((x) => !x.isActive).length}
          icon={PauseCircle}
          helperText="Currently archived"
          tone="neutral"
          density="compact"
        />
        <KpiCard
          title="Companies"
          value={
            isLoading
              ? "—"
              : new Set(categories.map((x) => x.companyId)).size
          }
          icon={Building2}
          helperText="Represented in this list"
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <AssetCategoryToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={handleCreate}
        onRefresh={() => {
          void refetch();
        }}
        refreshing={isFetching}
        canCreate={canCreate}
      />

      <AssetCategoryTable
        data={categories}
        onEdit={handleEdit}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load asset categories.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />

      <AssetCategoryDialog
        open={open}
        onOpenChange={setOpen}
        assetCategory={selectedCategory}
      />
    </WorkspaceShell>
  );
}
