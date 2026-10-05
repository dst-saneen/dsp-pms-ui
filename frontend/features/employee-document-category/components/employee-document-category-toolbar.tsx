"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageToolbar } from "@/components/common/page-toolbar";

interface EmployeeDocumentCategoryToolbarProps {
  onAdd?: () => void;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function EmployeeDocumentCategoryToolbar({
  onAdd,
  onRefresh,
  search,
  onSearchChange,
}: EmployeeDocumentCategoryToolbarProps) {
  return (
    <PageToolbar>
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search document categories..."
        className="max-w-sm"
      />

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>

        {onAdd ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
