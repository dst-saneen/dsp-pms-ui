"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/common/page-toolbar";

interface DepartmentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd?: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function DepartmentToolbar({
  search,
  onSearchChange,
  onAdd,
  onRefresh,
  refreshing = false,
}: DepartmentToolbarProps) {
  return (
    <PageToolbar>
      <Input
        placeholder="Search departments..."
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

        {onAdd ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Department
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
