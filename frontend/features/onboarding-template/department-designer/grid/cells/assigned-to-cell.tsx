"use client";

import { formatOwnerTypeLabel } from "@/features/onboarding-template/editor/canvas/task-editor/fields/owner-type-select";

import type { DepartmentTaskRowModel } from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}

export function AssignedToCell({ row }: Props) {
  return <div>{formatOwnerTypeLabel(row.assignedTo)}</div>;
}
