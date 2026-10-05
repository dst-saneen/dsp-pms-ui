"use client";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}

export function ApprovalCell({
  row,
}: Props) {
  return (
    <div>
      {row.approvalWorkflowName || "-"}
    </div>
  );
}