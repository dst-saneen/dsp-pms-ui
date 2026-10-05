"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, CheckCircle2, PauseCircle, UserPlus } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { AssignEmployeeAssetDialog } from "@/features/employee-asset/dialogs/assign-employee-asset-dialog";
import { useDepartments } from "@/features/lookups/hooks/use-departments";

import { AssetToolbar } from "./asset-toolbar";
import { AssetTable } from "./asset-table";
import { AssetInboxPanel } from "./asset-inbox-panel";
import { AssetDialog } from "../dialogs/asset-dialog";
import { useAssets } from "../hooks/use-assets";
import { useAssetSummary } from "../hooks/use-asset-inbox";
import { useAssetDepartments } from "../hooks/use-asset-inbox";
import { hasAllowedAction } from "../lib/allowed-actions";
import type { Asset } from "../types/asset";

export function AssetWorkspace() {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignAssetId, setAssignAssetId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => setKeyword(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const { data, refetch, isFetching, isLoading, error } = useAssets({
    catalog: "PHYSICAL",
    keyword: keyword || undefined,
    departmentId: departmentId || undefined,
  });
  const { data: summary } = useAssetSummary();
  const { data: grantedDepartments = [], isLoading: grantedLoading } =
    useAssetDepartments();
  const { data: allDepartments = [], isLoading: allDepartmentsLoading } =
    useDepartments(undefined, {
      enabled: !grantedLoading && grantedDepartments.length === 0,
    });

  const assets = data?.items ?? [];
  const canCreate =
    hasPermission("assets.assets.manage") ||
    hasPermission("assets.department.manage");

  const departmentItems = useMemo(
    () =>
      grantedDepartments.length > 0
        ? grantedDepartments.map((department) => ({
            id: department.id,
            code: department.code,
            name: department.name,
          }))
        : allDepartments,
    [allDepartments, grantedDepartments],
  );
  const departmentsLoading = grantedLoading || allDepartmentsLoading;

  const handleCreate = () => {
    setSelectedAsset(null);
    setOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    if (!hasAllowedAction(asset.allowedActions, "UPDATE_METADATA")) {
      return;
    }
    setSelectedAsset(asset);
    setOpen(true);
  };

  const handleAssign = (asset: Asset) => {
    if (!hasAllowedAction(asset.allowedActions, "ASSIGN")) {
      return;
    }
    setAssignAssetId(asset.id);
    setAssignOpen(true);
  };

  return (
    <WorkspaceShell>
      <KpiGrid columns={4}>
        <KpiCard
          title="Physical items"
          value={isLoading ? "—" : data?.total ?? assets.length}
          icon={Boxes}
          helperText="Hardware, general items, and access cards"
          density="compact"
        />
        <KpiCard
          title="Active"
          value={isLoading ? "—" : summary?.active ?? "—"}
          icon={CheckCircle2}
          helperText="Enabled records in this company (includes licences)"
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Inactive"
          value={isLoading ? "—" : summary?.inactive ?? "—"}
          icon={PauseCircle}
          helperText="Archived or inactive"
          tone="neutral"
          density="compact"
        />
        <KpiCard
          title="With employees"
          value={isLoading ? "—" : summary?.assigned ?? "—"}
          icon={UserPlus}
          helperText="Physical assignments in this company"
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <AssetInboxPanel />

      <AssetToolbar
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departmentItems}
        departmentsLoading={departmentsLoading}
        onAdd={handleCreate}
        onRefresh={() => {
          void refetch();
        }}
        canCreate={canCreate}
        addLabel="Add asset"
        searchPlaceholder="Search physical assets..."
        refreshing={isFetching}
      />

      <AssetTable
        data={assets}
        onEdit={handleEdit}
        onAssign={handleAssign}
        isLoading={isLoading}
        error={error ? getApiErrorMessage(error, "We could not load assets.") : null}
        onRetry={() => {
          void refetch();
        }}
      />

      <AssetDialog
        open={open}
        onOpenChange={setOpen}
        asset={selectedAsset}
        catalog="PHYSICAL"
      />
      <AssignEmployeeAssetDialog
        open={assignOpen}
        onOpenChange={(next) => {
          setAssignOpen(next);
          if (!next) {
            setAssignAssetId(undefined);
          }
        }}
        assetId={assignAssetId}
      />
    </WorkspaceShell>
  );
}
