"use client";

import { Card } from "@/components/ui/card";

import { TASK_MATRIX_COLUMNS } from "./onboarding-task-columns";
import { useTaskMatrix } from "../hooks/use-task-matrix";

export function OnboardingTaskMatrix() {
  const {
    rows,
    selectedTask,
    dispatch,
    updateRow,
  } = useTaskMatrix();

  return (
    <Card className="h-full overflow-auto">

      <table className="w-full border-collapse">

        <thead className="sticky top-0 bg-background z-10">

          <tr>

            {TASK_MATRIX_COLUMNS.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                }}
                className="border-b px-3 py-2 text-left text-xs font-semibold"
              >
                {column.title}
              </th>
            ))}

          </tr>

        </thead>

        <tbody>

          {rows.map((task) => (

            <tr
              key={task.id}
              className={
                selectedTask?.id === task.id
                  ? "bg-muted"
                  : ""
              }
              onClick={() =>
                dispatch({
                  type: "SELECT_TASK",
                  payload: task,
                })
              }
            >

              <td className="border-b px-3 py-2">
                {task.displayOrder}
              </td>

              <td className="border-b px-3 py-2">
                {task.departmentName}
              </td>

              <td className="border-b px-3 py-2">
                {task.taskGroupName}
              </td>

              <td className="border-b px-3 py-2">

                <input
                  className="w-full border rounded px-2 py-1"
                  value={task.taskName}
                  onChange={(e) =>
                    updateRow({
                      ...task,
                      taskName: e.target.value,
                    })
                  }
                />

              </td>

              <td className="border-b px-3 py-2">
                {task.ownerType}
              </td>

              <td className="border-b px-3 py-2">
                {task.workType}
              </td>

              <td className="border-b px-3 py-2">
                {task.priority}
              </td>

              <td className="border-b px-3 py-2">

                <input
                  type="checkbox"
                  checked={task.isMandatory}
                  onChange={(e) =>
                    updateRow({
                      ...task,
                      isMandatory: e.target.checked,
                    })
                  }
                />

              </td>

              <td className="border-b px-3 py-2">
                {task.dueDays}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </Card>
  );
}