"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DepartmentTaskRowModel } from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
  onDelete?: () => void;
}

export function ActionCell({ onDelete }: Props) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Delete task"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
