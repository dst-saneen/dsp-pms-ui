"use client";

import {
  NumericField,
} from "../fields";

import {
  useTaskEditor,
} from "../hooks";

export function TaskSchedulingSection() {
  const {
    task,
    updateTask,
  } = useTaskEditor();

  if (!task) {
    return null;
  }

  return (
    <div className="space-y-6">

      <NumericField
        label="Due Days"
        value={task.dueDays}
        onChange={(value) =>
          updateTask(
            "dueDays",
            value,
          )
        }
      />

      <NumericField
        label="Reminder Interval (Days)"
        value={task.reminderIntervalDays}
        onChange={(value) =>
          updateTask(
            "reminderIntervalDays",
            value,
          )
        }
      />

      <NumericField
        label="Estimated Duration (Minutes)"
        value={task.estimatedDurationMinutes}
        onChange={(value) =>
          updateTask(
            "estimatedDurationMinutes",
            value,
          )
        }
      />

    </div>
  );
}