"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;

  onDelete?: () => void;
}

export function TaskGroupCell({
  row,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2">

      <span className="font-medium">
        {row.groupName}
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

    </div>
  );
}