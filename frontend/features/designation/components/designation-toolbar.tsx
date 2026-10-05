"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageToolbar } from "@/components/common/page-toolbar";
import { useAuth } from "@/providers/auth-provider";

interface DesignationToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;

  onAdd: () => void;

  onRefresh: () => void;
  refreshing?: boolean;
}

export function DesignationToolbar({
  search,
  onSearchChange,
  onAdd,
  onRefresh,
  refreshing = false,
}: DesignationToolbarProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("organization.structure.manage");

  return (
    <PageToolbar>
      <Input
        placeholder="Search designations..."
        className="max-w-sm"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>

        {canCreate ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Designation
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
