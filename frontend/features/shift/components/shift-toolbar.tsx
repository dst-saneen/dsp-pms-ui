"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageToolbar } from "@/components/common/page-toolbar";

interface ShiftToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;

  onAdd: () => void;
  canCreate?: boolean;

  onRefresh: () => void;
  refreshing?: boolean;
}

export function ShiftToolbar({
  search,
  onSearchChange,
  onAdd,
  canCreate = true,
  onRefresh,
  refreshing = false,
}: ShiftToolbarProps) {
  return (
    <PageToolbar>
      <Input
        placeholder="Search shifts..."
        className="max-w-sm"
        value={search}
        onChange={(e) =>
          onSearchChange(e.target.value)
        }
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </Button>

        {canCreate ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Shift
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}