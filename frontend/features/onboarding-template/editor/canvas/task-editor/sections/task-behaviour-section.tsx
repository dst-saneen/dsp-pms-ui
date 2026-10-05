"use client";

import {
  SwitchField,
} from "../fields";

import {
  useTaskEditor,
} from "../hooks";

export function TaskBehaviourSection() {
  const {
    task,
    updateTask,
  } = useTaskEditor();

  if (!task) {
    return null;
  }

  return (
    <div className="space-y-6">

      <SwitchField
        label="Mandatory"
        checked={task.isMandatory}
        onChange={(value) =>
          updateTask(
            "isMandatory",
            value,
          )
        }
      />


      <SwitchField
        label="Auto Complete"
        checked={
          task.autoComplete ??
          false
        }
        onChange={(value) =>
          updateTask(
            "autoComplete",
            value,
          )
        }
      />

      <SwitchField
        label="Allow Skip"
        checked={
          task.allowSkip ??
          false
        }
        onChange={(value) =>
          updateTask(
            "allowSkip",
            value,
          )
        }
      />

      <SwitchField
        label="Allow Resubmit"
        checked={
          task.allowResubmit ??
          false
        }
        onChange={(value) =>
          updateTask(
            "allowResubmit",
            value,
          )
        }
      />

      <SwitchField
        label="Allow Reopen"
        checked={
          task.allowReopen ??
          false
        }
        onChange={(value) =>
          updateTask(
            "allowReopen",
            value,
          )
        }
      />

    </div>
  );
}