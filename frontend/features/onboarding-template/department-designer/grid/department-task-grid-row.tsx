"use client";

import {
  TableCell,
  TableRow,
} from "@/components/ui/table";

import type { DepartmentTaskRowModel } from "./department-task-grid-types";

import {
  TaskGroupCell,
  TaskSequenceCell,
  TaskNameCell,
  AssignedToCell,
  DueOffsetCell,
  MandatoryCell,
  ActionCell,
} from "./cells";

interface Props {
  row: DepartmentTaskRowModel;
  renderGroup: boolean;
  onEditTask(taskId: string): void;
  onDeleteTask(taskId: string): void;
  onDeleteGroup(groupId: string): void;
}

export function DepartmentTaskGridRow({
  row,
  renderGroup,
  onEditTask,
  onDeleteTask,
  onDeleteGroup,
}: Props) {
  return (
    <TableRow>
      {renderGroup ? (
        <>
          <TableCell rowSpan={row.rowSpan + 1}>
            {row.groupSequence}
          </TableCell>
          <TableCell rowSpan={row.rowSpan + 1}>
            <TaskGroupCell
              row={row}
              onDelete={() => onDeleteGroup(row.groupId)}
            />
          </TableCell>
        </>
      ) : null}

      {row.hasTasks ? (
        <>
          <TableCell>
            <TaskSequenceCell row={row} />
          </TableCell>
          <TableCell>
            <TaskNameCell row={row} onEdit={() => onEditTask(row.taskId)} />
          </TableCell>
          <TableCell>
            <AssignedToCell row={row} />
          </TableCell>
          <TableCell>
            <DueOffsetCell row={row} />
          </TableCell>
          <TableCell>
            <MandatoryCell row={row} />
          </TableCell>
          <TableCell>
            <ActionCell
              row={row}
              onDelete={() => onDeleteTask(row.taskId)}
            />
          </TableCell>
        </>
      ) : (
        <TableCell
          colSpan={6}
          className="text-muted-foreground h-12 text-center"
        >
          No tasks yet
        </TableCell>
      )}
    </TableRow>
  );
}
