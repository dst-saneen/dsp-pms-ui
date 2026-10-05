"use client";

import {
  Table,
  TableBody,
} from "@/components/ui/table";

import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";

import { DepartmentTaskGridHeader } from "./department-task-grid-header";
import { DepartmentTaskGridRow } from "./department-task-grid-row";
import { DepartmentTaskGridFooterRow } from "./department-task-grid-footer-row";
import { mapDepartmentTaskGrid } from "./department-task-grid-mapper";

interface Props {
  taskGroups: OnboardingTaskGroup[];
  onAddTask(groupId: string): void;
  onEditTask(taskId: string): void;
  onDeleteTask(taskId: string): void;
  onDeleteGroup(groupId: string): void;
}

export function DepartmentTaskGrid({
  taskGroups,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onDeleteGroup,
}: Props) {
  const rows = mapDepartmentTaskGrid(taskGroups);

  return (
    <Table>
      <DepartmentTaskGridHeader />
      <TableBody>
        {(() => {
          const content: React.ReactNode[] = [];
          let index = 0;

          while (index < rows.length) {
            const first = rows[index];

            for (let i = 0; i < first.rowSpan; i++) {
              const row = rows[index + i];
              content.push(
                <DepartmentTaskGridRow
                  key={row.taskId || `${row.groupId}-${i}`}
                  row={row}
                  renderGroup={i === 0}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onDeleteGroup={onDeleteGroup}
                />,
              );
            }

            content.push(
              <DepartmentTaskGridFooterRow
                key={`${first.groupId}-footer`}
                groupId={first.groupId}
                onAddTask={onAddTask}
              />,
            );

            index += first.rowSpan;
          }

          return content;
        })()}
      </TableBody>
    </Table>
  );
}
