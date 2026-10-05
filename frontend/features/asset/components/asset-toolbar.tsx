"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/common/page-toolbar";
import { LookupSelect } from "@/components/forms";
import type { LookupItem } from "@/features/lookups/types/lookup";

interface AssetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  departmentId: string;
  onDepartmentChange: (value: string) => void;
  departments: LookupItem[];
  departmentsLoading?: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  canCreate?: boolean;
  addLabel?: string;
  searchPlaceholder?: string;
  refreshing?: boolean;
}

export function AssetToolbar({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  departments,
  departmentsLoading,
  onAdd,
  onRefresh,
  canCreate = true,
  addLabel = "Add asset",
  searchPlaceholder = "Search assets...",
  refreshing = false,
}: AssetToolbarProps) {
  return (
    <PageToolbar>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          aria-label="Search assets"
          placeholder={searchPlaceholder}
          className="max-w-sm"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="w-64">
          <label className="sr-only" htmlFor="asset-department-filter">
            Filter assets by department
          </label>
          <LookupSelect
            id="asset-department-filter"
            value={departmentId}
            onChange={onDepartmentChange}
            items={departments}
            placeholder="All departments"
            loading={departmentsLoading}
            clearable
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>

        {canCreate ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
