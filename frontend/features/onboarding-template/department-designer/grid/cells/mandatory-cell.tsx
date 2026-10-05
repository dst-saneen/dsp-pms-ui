"use client";

import type {
  DepartmentTaskRowModel,
} from "../department-task-grid-types";

interface Props {
  row: DepartmentTaskRowModel;
}

export function MandatoryCell({
  row,
}: Props) {
  return (
    <div className="text-center">
      {row.mandatory ? "Yes" : "No"}
    </div>
  );
}