"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageToolbar } from "@/components/common/page-toolbar";

interface EmployeeDocumentToolbarProps {
  onAdd?: () => void;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function EmployeeDocumentToolbar({
  onAdd,
  onRefresh,
  search,
  onSearchChange,
}: EmployeeDocumentToolbarProps) {
  return (
    <PageToolbar>
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search documents..."
        className="max-w-sm"
      />

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>

        {onAdd ? (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Document
          </Button>
        ) : null}
      </div>
    </PageToolbar>
  );
}
