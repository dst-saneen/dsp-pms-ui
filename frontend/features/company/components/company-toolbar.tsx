"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/common/page-toolbar";

interface CompanyToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd?: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function CompanyToolbar({
  search,
  onSearchChange,
  onAdd,
  onRefresh,
  refreshing = false,
}: CompanyToolbarProps) {
  return (
    <PageToolbar>
      <Input
        placeholder="Search companies..."
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
            Add Company
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
