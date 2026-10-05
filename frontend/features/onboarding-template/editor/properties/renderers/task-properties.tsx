"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  useTaskEditor,
} from "../../canvas/task-editor/hooks";

export function TaskProperties() {
  const {
    task,
    saving,
  } = useTaskEditor();

  if (!task) {
    return null;
  }

  return (
    <Card className="border-0 shadow-none">

      <CardHeader>
        <CardTitle>
          Task Metadata
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        <Property
          label="Task Name"
          value={task.taskName}
        />

        <Property
          label="Task ID"
          value={task.id}
        />

        <Property
          label="Owner Type"
          value={task.ownerType}
        />

        <Property
          label="Work Type"
          value={task.workType}
        />

        <Property
          label="Priority"
          value={String(task.priority)}
        />

        <Property
          label="Sequence"
          value={String(task.sequenceNo)}
        />

        <Property
          label="Mandatory"
          value={
            task.isMandatory
              ? "Yes"
              : "No"
          }
        />

        <Property
          label="Saving"
          value={
            saving
              ? "Yes"
              : "No"
          }
        />

      </CardContent>

    </Card>
  );
}

function Property({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>

      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="font-medium">
        {value ?? "-"}
      </p>

    </div>
  );
}