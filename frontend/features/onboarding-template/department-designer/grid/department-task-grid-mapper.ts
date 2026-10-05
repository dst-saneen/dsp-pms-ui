import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";
import type { OnboardingTemplateTask } from "../../types";

import type {
  DepartmentTaskRowModel,
} from "./department-task-grid-types";

/** Fields the grid mapper reads from designer task payloads. */
interface DepartmentTaskSource
  extends Partial<OnboardingTemplateTask> {
  id: string;
  taskName: string;
  displayOrder?: number;
  sequenceNo?: number;
  ownerDepartmentId?: string;
  assignedDepartmentName?: string;
  ownerType?: string | null;
  dueOffset?: number;
  dueDays?: number | null;
  isMandatory?: boolean;
  mandatory?: boolean;
  approvalWorkflowId?: string | null;
  approvalWorkflowName?: string;
}

interface TaskGroupSource
  extends Pick<OnboardingTaskGroup, "id" | "groupName"> {
  displayOrder?: number;
  tasks?: DepartmentTaskSource[];
}

export function mapDepartmentTaskGrid(
  taskGroups: TaskGroupSource[],
): DepartmentTaskRowModel[] {

  const rows: DepartmentTaskRowModel[] = [];

  taskGroups.forEach(
    (
      group,
      groupIndex,
    ) => {

      const tasks =
        group.tasks ?? [];

      const rowSpan =
        Math.max(tasks.length, 1);

      //
      // Empty Task Group
      //
      if (tasks.length === 0) {

        rows.push({

          groupId: group.id,

          groupSequence:
            group.displayOrder ??
            groupIndex + 1,

          groupName:
            group.groupName,

          isFirstRow: true,

          rowSpan: 1,

          hasTasks: false,

          taskId: "",

          taskSequence: 0,

          taskName: "",

          ownerDepartmentId: undefined,

          ownerDepartmentName: undefined,

          assignedTo: "",

          dueOffset: undefined,

          mandatory: false,

          approvalWorkflowId: undefined,

          approvalWorkflowName: undefined,

          task: null,

        });

        return;

      }

      //
      // Tasks
      //
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

            hasTasks: true,

            taskId:
              task.id,

            taskSequence:
              task.displayOrder ??
              task.sequenceNo ??
              taskIndex + 1,

            taskName:
              task.taskName,

            ownerDepartmentId:
              task.ownerDepartmentId,

            ownerDepartmentName:
              task.assignedDepartmentName,

            assignedTo:
              task.ownerType ?? "",

            dueOffset:
              task.dueDays ?? task.dueOffset,

            mandatory:
              task.isMandatory ?? task.mandatory ?? false,

            approvalWorkflowId:
              task.approvalWorkflowId ?? undefined,

            approvalWorkflowName:
              task.approvalWorkflowName,

            task,

          });

        },
      );

    },
  );

  return rows;

}
