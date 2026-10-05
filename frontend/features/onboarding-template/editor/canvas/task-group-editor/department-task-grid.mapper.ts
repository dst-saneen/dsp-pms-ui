import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";
import type { OnboardingTemplateTask } from "../../../types";

/** Fields the table mapper reads from designer task payloads. */
interface TaskSource
  extends Partial<OnboardingTemplateTask> {
  id: string;
  taskName: string;
  displayOrder?: number;
  sequenceNo?: number;
  assignedDepartmentName?: string;
  ownerType?: string | null;
  dueOffset?: number;
  mandatory?: boolean;
  approvalWorkflowName?: string;
}

interface TaskGroupSource
  extends Pick<OnboardingTaskGroup, "id" | "groupName"> {
  displayOrder?: number;
  tasks?: TaskSource[];
}

export interface TaskTableRow {
  groupId: string;

  groupSequence: number;

  groupName: string;

  isFirstRow: boolean;

  rowSpan: number;

  taskId: string;

  taskSequence: number;

  taskName: string;

  ownerDepartment?: string;

  assignedTo: string;

  dueOffset?: number;

  mandatory: boolean;

  approval?: string;

  task: TaskSource | null;
}

export function mapTaskTableRows(
  taskGroups: TaskGroupSource[],
): TaskTableRow[] {
  const rows: TaskTableRow[] = [];

  taskGroups.forEach(
    (
      group,
      groupIndex,
    ) => {
      const tasks =
        group.tasks ?? [];

      const rowSpan =
        Math.max(tasks.length, 1);

      if (tasks.length === 0) {
        rows.push({
          groupId: group.id,
          groupSequence:
            group.displayOrder ??
            groupIndex + 1,
          groupName:
            group.groupName,
          isFirstRow: true,
          rowSpan,
          taskId: "",
          taskSequence: 0,
          taskName: "",
          assignedTo: "",
          mandatory: false,
          task: null,
        });

        return;
      }

      tasks.forEach(
        (
          task,
          taskIndex: number,
        ) => {
          rows.push({
            groupId: group.id,

            groupSequence:
              group.displayOrder ??
              groupIndex + 1,

            groupName:
              group.groupName,

            isFirstRow:
              taskIndex === 0,

            rowSpan,

            taskId: task.id,

            taskSequence:
              task.displayOrder ??
              task.sequenceNo ??
              taskIndex + 1,

            taskName:
              task.taskName,

            ownerDepartment:
              task.assignedDepartmentName,

            assignedTo:
              task.ownerType ?? "",

            dueOffset:
              task.dueOffset,

            mandatory:
              task.mandatory ?? false,

            approval:
              task.approvalWorkflowName,

            task,
          });
        },
      );
    },
  );

  return rows;
}
