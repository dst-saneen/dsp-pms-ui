"use client";

import type { DepartmentTaskRowModel } from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
  onEdit?: () => void;
}

export function TaskNameCell({ row, onEdit }: Props) {
  if (!onEdit) {
    return (
      <div className="min-w-[220px] truncate">{row.taskName || "—"}</div>
    );
  }

  return (
    <button
      type="button"
      className="min-w-[220px] truncate text-left font-medium hover:underline"
      onClick={onEdit}
    >
      {row.taskName || "—"}
    </button>
  );
}
