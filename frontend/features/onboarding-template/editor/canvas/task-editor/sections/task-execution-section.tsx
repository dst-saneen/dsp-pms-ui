"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { OwnerTypeSelect, WorkTypeSelect } from "../fields";
import { useTaskEditor } from "../hooks";
import { AssetTypeSelect } from "../fields/asset-type-select";

export function TaskExecutionSection() {
  const { task, enclosingDepartment, updateTask } = useTaskEditor();
  const versionId = enclosingDepartment?.onboardingTemplateVersionId;

  if (!task) {
    return null;
  }

  const inheritedDepartmentName =
    enclosingDepartment?.department?.departmentName ?? "Department slice";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">Assignment</h3>
        <p className="text-sm text-muted-foreground">
          Department ownership is inherited from the enclosing Department
          slice. Employee and Manager owners are resolved at runtime.
        </p>
      </div>

      <div className="grid gap-6">
        <div>
          <Label>Work type</Label>
          <WorkTypeSelect
            value={task.workType === "ASSET" ? "ASSET" : "CHECKLIST"}
            onChange={(value) => {
              updateTask("workType", value);
              if (value !== "ASSET") {
                updateTask("referenceType", null);
                updateTask("referenceId", null);
              } else {
                updateTask("referenceType", "ASSET_TYPE");
                updateTask("ownerType", "DEPARTMENT");
              }
            }}
          />
        </div>

        <div>
          <Label>Assigned to</Label>
          <OwnerTypeSelect
            value={task.ownerType}
            onChange={(value) => {
              updateTask("ownerType", value);
              updateTask("assignedDepartmentId", undefined);
              updateTask("assignedDesignationId", undefined);
              updateTask("assignedEmployeeId", undefined);
            }}
          />
        </div>

        <div>
          <Label>Responsible Department</Label>
          <Input value={inheritedDepartmentName} readOnly />
          <p className="mt-1 text-sm text-muted-foreground">
            Inherited from the enclosing Department slice and cannot be
            selected again at task level.
          </p>
        </div>

        {task.ownerType === "EMPLOYEE" && (
          <p className="text-sm text-muted-foreground">
            Employee work is assigned at runtime to the onboarding
            employee&apos;s linked user. Do not pick a named person in the
            template.
          </p>
        )}

        {task.ownerType === "MANAGER" && (
          <p className="text-sm text-muted-foreground">
            Manager work is assigned at runtime to the onboarding
            employee&apos;s reporting manager. Do not pick a named person in
            the template.
          </p>
        )}

        {task.workType === "ASSET" && versionId && (
          <div>
            <Label>Asset Type</Label>
            <AssetTypeSelect
              versionId={versionId}
              value={task.referenceId}
              onChange={(assetType) => {
                updateTask("referenceType", "ASSET_TYPE");
                updateTask("referenceId", assetType.id);
                updateTask("ownerType", "DEPARTMENT");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
