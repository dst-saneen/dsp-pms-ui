"use client";

import { DataTable } from "@/components/tables/data-table";

import { taskColumns, type TaskColumnRow } from "./task-columns";

interface Props {
  data: TaskColumnRow[];
  onEdit?: (task: TaskColumnRow) => void;
}

export function TaskTable({
  data,
  onEdit,
}: Props) {
  return (
    <DataTable
      columns={taskColumns()}
      data={data}
      onRowClick={(task) => onEdit?.(task)}
    />
  );
}
