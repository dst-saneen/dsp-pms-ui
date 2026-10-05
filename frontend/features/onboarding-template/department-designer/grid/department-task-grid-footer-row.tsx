"use client";

import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface Props {
  groupId: string;

  onAddTask(
    groupId: string,
  ): void;
}

export function DepartmentTaskGridFooterRow({
  groupId,
  onAddTask,
}: Props) {
  return (
    <TableRow>

        <TableCell colSpan={9}>

            <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={() => onAddTask(groupId)}
            >
            + Add Task
            </Button>

        </TableCell>

    </TableRow>
  );
}