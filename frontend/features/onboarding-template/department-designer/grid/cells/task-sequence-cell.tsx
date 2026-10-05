"use client";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}

export function TaskSequenceCell({
  row,
}: Props) {
  return (
    <div className="text-center">
      {row.taskSequence}
    </div>
  );
}