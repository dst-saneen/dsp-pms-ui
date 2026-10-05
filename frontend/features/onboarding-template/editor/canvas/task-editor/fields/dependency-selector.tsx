"use client";

import { Label } from "@/components/ui/label";

interface TaskOption {
  id: string;
  taskName: string;
}

interface Props {
  tasks: TaskOption[];
  value?: string[];
  onChange(value: string[]): void;
}

export function DependencySelector({
  tasks,
  value = [],
  onChange,
}: Props) {

  function toggle(taskId: string) {

    if (value.includes(taskId)) {

      onChange(
        value.filter(
          (id) => id !== taskId,
        ),
      );

      return;
    }

    onChange([
      ...value,
      taskId,
    ]);

  }

  if (tasks.length === 0) {

    return (

      <p className="text-sm text-muted-foreground">

        No other tasks available.

      </p>

    );

  }

  return (

    <div className="space-y-2 rounded-md border p-3 max-h-72 overflow-auto">

      {tasks.map((task) => (

        <label
          key={task.id}
          className="flex items-center gap-3 cursor-pointer"
        >

          <input
            type="checkbox"
            className="h-4 w-4"
            checked={value.includes(task.id)}
            onChange={() =>
              toggle(task.id)
            }
          />

          <Label className="cursor-pointer">

            {task.taskName}

          </Label>

        </label>

      ))}

    </div>

  );

}