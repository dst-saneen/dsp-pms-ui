"use client";

import { useState } from "react";
import { Building2, CheckCircle2, PauseCircle, Tags } from "lucide-react";

import { AssetTypeToolbar } from "./asset-type-toolbar";
import { AssetTypeTable } from "./asset-type-table";
import { AssetTypeDialog } from "../dialogs/asset-type-dialog";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { useAssetTypes } from "../hooks/use-asset-types";
import type { AssetType } from "../types/asset-type";

export function AssetTypeWorkspace() {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const { data, refetch, isFetching, isLoading, error } = useAssetTypes({
    keyword: search.trim() || undefined,
  });
  const assetTypes = data?.items ?? [];
  const canCreate = hasPermission("assets.assets.manage");

  const handleCreate = () => {
    setSelectedAssetType(null);
    setOpen(true);
  };

  const handleEdit = (assetType: AssetType) => {
    if (!hasAllowedAction(assetType.allowedActions, "EDIT")) {
      return;
    }
    setSelectedAssetType(assetType);
    setOpen(true);
  };

  return (
    <WorkspaceShell>
      <KpiGrid columns={4}>
        <KpiCard
          title="Total Asset Types"
          value={isLoading ? "—" : data?.total ?? assetTypes.length}
          icon={Tags}
          helperText="Defined asset classifications"
          density="compact"
        />
        <KpiCard
          title="Active"
          value={isLoading ? "—" : assetTypes.filter((x) => x.isActive).length}
          icon={CheckCircle2}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Archived"
          value={isLoading ? "—" : assetTypes.filter((x) => !x.isActive).length}
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
              : new Set(assetTypes.map((x) => x.companyId)).size
          }
          icon={Building2}
          helperText="Represented in this list"
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <AssetTypeToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={handleCreate}
        onRefresh={() => {
          void refetch();
        }}
        refreshing={isFetching}
        canCreate={canCreate}
      />

      <AssetTypeTable
        data={assetTypes}
        onEdit={handleEdit}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load asset types.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />

      <AssetTypeDialog
        open={open}
        onOpenChange={setOpen}
        assetType={selectedAssetType}
      />
    </WorkspaceShell>
  );
}
