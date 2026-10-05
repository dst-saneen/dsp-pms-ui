"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DependencySelector } from "../fields";
import { useTaskEditor } from "../hooks";

export function TaskAdvancedSection() {
  const { task, updateTask, allTasks } = useTaskEditor();

  if (!task) {
    return null;
  }

  const dependencyCandidates = allTasks.filter(
    (candidate) => candidate.id !== task.id,
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">Dependencies</h3>
        <p className="text-sm text-muted-foreground">
          Configure task ordering within this version. Approval, generic
          automation, and named assignment are not supported in this release.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label>Depends on</Label>
          <Select
            value={task.dependsOnTaskId ?? "__none__"}
            onValueChange={(value) =>
              updateTask(
                "dependsOnTaskId",
                value === "__none__" ? undefined : value,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No prerequisite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No prerequisite</SelectItem>
              {dependencyCandidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.taskName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Related tasks</Label>
          <DependencySelector
            tasks={dependencyCandidates.map((candidate) => ({
              id: candidate.id,
              taskName: candidate.taskName,
            }))}
            value={task.dependsOnTaskId ? [task.dependsOnTaskId] : []}
            onChange={(value) =>
              updateTask("dependsOnTaskId", value[0] ?? undefined)
            }
          />
        </div>
      </div>
    </div>
  );
}
