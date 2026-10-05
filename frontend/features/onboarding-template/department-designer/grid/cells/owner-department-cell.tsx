"use client";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}
export function OwnerDepartmentCell({
  row,
}: Props) {
  return (
    <div>
      {row.ownerDepartmentId || "-"}
    </div>
  );
}