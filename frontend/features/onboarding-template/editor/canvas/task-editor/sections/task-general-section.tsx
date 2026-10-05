"use client";


import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  useTaskEditor,
} from "../hooks";

import {
  PrioritySelect,
  NumericField,
} from "../fields";


export function TaskGeneralSection() {

  const {
    task,
    updateTask,
    } = useTaskEditor();

  if (!task) {
    return null;
  }

  return (
    <div className="space-y-6">

      <h3 className="text-lg font-semibold">
        General
      </h3>

      <div className="grid gap-6">

        <div>

          <Label>
            Task Name
          </Label>

          <Input
            value={task.taskName}
            onChange={(e) =>
                updateTask(
                "taskName",
                e.target.value,
                )
            }
            />

        </div>

        <div>

          <Label>
            Description
          </Label>

          <Textarea
            value={task.description ?? ""}
            onChange={(e) =>
                updateTask(
                "description",
                e.target.value,
                )
            }
            />

        </div>

        <div className="grid grid-cols-2 gap-4">

          <div>

            <Label>
              Sequence
            </Label>

            <NumericField
                label="Sequence"
                value={task.sequenceNo}
                onChange={(value) =>
                    updateTask(
                    "sequenceNo",
                    value,
                    )
                }
            />

          </div>

          <div>

            <Label>
              Priority
            </Label>

            <PrioritySelect
                value={task.priority}
                onChange={(value)=>
                    updateTask(
                        "priority",
                        value,
                    )
                }
            />

          </div>

        </div>

      </div>

    </div>
  );
}