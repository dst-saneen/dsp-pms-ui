"use client";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}
export function DueOffsetCell({
  row,
}: Props) {
  return (
    <div className="text-center">
      {row.dueOffset == null ? "-" : `D+${row.dueOffset}`}
    </div>
  );
}