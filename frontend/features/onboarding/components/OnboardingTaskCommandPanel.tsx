"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingTaskKeys } from "../hooks/query-keys";
import { createOnboardingOperationId } from "../lib/operation-id";
import { TASK_ACTION_LABELS } from "../lib/task-actions";
import { OnboardingApiService } from "../services/onboarding-api.service";
import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
  EmployeeOnboardingTaskRuntimeView,
} from "../types/onboarding.types";

interface OnboardingTaskCommandPanelProps {
  task: EmployeeOnboardingTaskRuntimeView;
  action: EmployeeOnboardingTaskAllowedAction;
  capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>;
  onCancel: () => void;
  onCompleted: () => void;
}

function isAssignmentAction(
  action: EmployeeOnboardingTaskAllowedAction,
): action is "ASSIGN" | "REASSIGN" {
  return action === "ASSIGN" || action === "REASSIGN";
}

function needsReason(
  action: EmployeeOnboardingTaskAllowedAction,
  capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>,
): boolean {
  if (capability.reasonRequired) {
    return true;
  }

  return (
    action === "REASSIGN" ||
    action === "UNASSIGN" ||
    action === "SKIP" ||
    action === "WAIVE" ||
    action === "REOPEN"
  );
}

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function OnboardingTaskCommandPanel({
  task,
  action,
  capability,
  onCancel,
  onCompleted,
}: OnboardingTaskCommandPanelProps) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const assignmentAction = isAssignmentAction(action);
  const fulfillAction = action === "FULFILL_ASSET";
  const reasonRequired = needsReason(action, capability);

  const candidatesQuery = useQuery({
    queryKey: onboardingTaskKeys.assigneeCandidates(task.id, keyword, 1),
    queryFn: () =>
      OnboardingApiService.getAssigneeCandidates(task.id, {
        keyword: keyword.trim() || undefined,
        page: 1,
        limit: 25,
      }),
    enabled: assignmentAction,
  });

  const assetCandidatesQuery = useQuery({
    queryKey: onboardingTaskKeys.assetCandidates(task.id, keyword, 1),
    queryFn: () =>
      OnboardingApiService.getAssetCandidates(task.id, {
        keyword: keyword.trim() || undefined,
        page: 1,
        limit: 25,
      }),
    enabled: fulfillAction,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const command = {
        operationId: createOnboardingOperationId(),
        expectedTaskVersion: task.version,
      };

      if (action === "ASSIGN" || action === "REASSIGN") {
        if (!assigneeEmployeeId) {
          throw new Error("Select a person to assign this task.");
        }

        return OnboardingApiService.assignTask(task.id, {
          ...command,
          assigneeEmployeeId,
          reason: reason.trim() || undefined,
        });
      }

      if (action === "UNASSIGN") {
        return OnboardingApiService.unassignTask(task.id, {
          ...command,
          reason: reason.trim(),
        });
      }

      if (action === "START") {
        return OnboardingApiService.startTask(task.id, {
          ...command,
          remarks: remarks.trim() || undefined,
        });
      }

      if (action === "COMPLETE") {
        return OnboardingApiService.completeTask(task.id, {
          ...command,
          remarks: remarks.trim() || undefined,
          overrideReason:
            capability.reasonField === "overrideReason"
              ? reason.trim() || undefined
              : undefined,
        });
      }

      if (action === "SKIP") {
        return OnboardingApiService.skipTask(task.id, {
          ...command,
          reason: reason.trim(),
        });
      }

      if (action === "WAIVE") {
        return OnboardingApiService.waiveTask(task.id, {
          ...command,
          reason: reason.trim(),
        });
      }

      if (action === "REOPEN") {
        return OnboardingApiService.reopenTask(task.id, {
          ...command,
          reason: reason.trim(),
        });
      }

      if (action === "FULFILL_ASSET") {
        const asset = assetCandidatesQuery.data?.items.find(
          (item) => item.assetId === selectedAssetId,
        );
        if (!asset) {
          throw new Error("Select an available laptop to assign.");
        }
        if (!effectiveDate) {
          throw new Error("Choose an effective date.");
        }

        return OnboardingApiService.fulfillAsset(task.id, {
          ...command,
          assetId: asset.assetId,
          expectedAssetVersion: asset.version,
          effectiveDate,
        });
      }

      throw new Error(`${TASK_ACTION_LABELS[action]} is not available here.`);
    },
    onSuccess: async () => {
      toast.success(
        action === "ASSIGN" || action === "REASSIGN"
          ? "Task assigned."
          : action === "FULFILL_ASSET"
            ? "Laptop assigned to employee."
            : `${TASK_ACTION_LABELS[action]} completed.`,
      );
      await queryClient.invalidateQueries({ queryKey: onboardingTaskKeys.all });
      onCompleted();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not complete that action."));
    },
  });

  const candidates = useMemo(
    () => candidatesQuery.data?.items ?? [],
    [candidatesQuery.data?.items],
  );
  const assetCandidates = useMemo(
    () => assetCandidatesQuery.data?.items ?? [],
    [assetCandidatesQuery.data?.items],
  );
  const selected = useMemo(
    () => candidates.find((item) => item.employeeId === assigneeEmployeeId),
    [assigneeEmployeeId, candidates],
  );
  const selectedAsset = useMemo(
    () => assetCandidates.find((item) => item.assetId === selectedAssetId),
    [assetCandidates, selectedAssetId],
  );

  const canSubmit =
    !mutation.isPending &&
    (!assignmentAction || Boolean(assigneeEmployeeId)) &&
    (!fulfillAction || (Boolean(selectedAssetId) && Boolean(effectiveDate))) &&
    (!reasonRequired || reason.trim().length >= 3);

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {action === "ASSIGN" || action === "REASSIGN"
            ? "Assign this task"
            : action === "FULFILL_ASSET"
              ? "Fulfil asset"
              : TASK_ACTION_LABELS[action]}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {assignmentAction
            ? "Choose someone in the executor department who has a login, then confirm."
            : fulfillAction
              ? "Pick an available laptop, set the effective date, then confirm. This completes the task."
              : "Confirm this action. Required fields must be completed before submit."}
        </p>
      </div>

      {assignmentAction ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assignee-search">Search people</Label>
            <Input
              id="assignee-search"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setAssigneeEmployeeId("");
              }}
              placeholder="Name or employee code"
            />
          </div>

          {candidatesQuery.isLoading ? (
            <div className="bg-muted h-24 animate-pulse rounded-lg" />
          ) : null}

          {candidatesQuery.error ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(
                candidatesQuery.error,
                "Could not load people for this department.",
              )}
            </p>
          ) : null}

          {candidatesQuery.isSuccess && candidates.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border bg-background p-3 text-sm">
              No employees with a login were found in{" "}
              {task.executorDepartment?.name ?? "the executor department"}. Add
              an IT/department employee with a user account, then try again.
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-background p-1">
              {candidates.map((candidate) => {
                const active = candidate.employeeId === assigneeEmployeeId;

                return (
                  <li key={candidate.employeeId}>
                    <button
                      type="button"
                      className={
                        active
                          ? "bg-primary/10 w-full rounded-md px-3 py-2 text-left"
                          : "hover:bg-muted w-full rounded-md px-3 py-2 text-left"
                      }
                      onClick={() => setAssigneeEmployeeId(candidate.employeeId)}
                    >
                      <div className="text-sm font-medium">
                        {candidate.displayName}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {candidate.employeeCode}
                        {candidate.designation
                          ? ` · ${candidate.designation.name}`
                          : ""}
                        {` · ${candidate.department.name}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {selected ? (
            <p className="text-sm">
              Assigning to{" "}
              <span className="font-medium">{selected.displayName}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {fulfillAction ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="asset-search">Search assets</Label>
            <Input
              id="asset-search"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setSelectedAssetId("");
              }}
              placeholder="Asset code or name"
            />
          </div>

          {assetCandidatesQuery.isLoading ? (
            <div className="bg-muted h-24 animate-pulse rounded-lg" />
          ) : null}

          {assetCandidatesQuery.error ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(
                assetCandidatesQuery.error,
                "Could not load available assets.",
              )}
            </p>
          ) : null}

          {assetCandidatesQuery.isSuccess && assetCandidates.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border bg-background p-3 text-sm">
              No available laptops found for this company/branch. Create an
              AVAILABLE Laptop asset in IT inventory, then try again.
            </p>
          ) : null}

          {assetCandidates.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-background p-1">
              {assetCandidates.map((asset) => {
                const active = asset.assetId === selectedAssetId;

                return (
                  <li key={asset.assetId}>
                    <button
                      type="button"
                      className={
                        active
                          ? "bg-primary/10 w-full rounded-md px-3 py-2 text-left"
                          : "hover:bg-muted w-full rounded-md px-3 py-2 text-left"
                      }
                      onClick={() => setSelectedAssetId(asset.assetId)}
                    >
                      <div className="text-sm font-medium">
                        {asset.safeLabel}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {asset.code} · {asset.availability}
                        {asset.owningDepartment
                          ? ` · ${asset.owningDepartment.name}`
                          : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="effective-date">Effective date</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </div>

          {selectedAsset ? (
            <p className="text-sm">
              Assigning{" "}
              <span className="font-medium">{selectedAsset.safeLabel}</span> to{" "}
              {task.employee.displayName}
            </p>
          ) : null}
        </div>
      ) : null}

      {action === "START" || action === "COMPLETE" ? (
        <div className="space-y-1.5">
          <Label htmlFor="task-remarks">Remarks (optional)</Label>
          <Textarea
            id="task-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
          />
        </div>
      ) : null}

      {reasonRequired || action === "REASSIGN" || capability.reasonField ? (
        <div className="space-y-1.5">
          <Label htmlFor="task-reason">
            {capability.reasonField === "overrideReason"
              ? "Override reason"
              : "Reason"}
            {reasonRequired ? " *" : " (optional)"}
          </Label>
          <Textarea
            id="task-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder={reasonRequired ? "At least 3 characters" : undefined}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "Saving..."
            : action === "ASSIGN" || action === "REASSIGN"
              ? "Confirm assign"
              : action === "FULFILL_ASSET"
                ? "Confirm fulfil"
                : TASK_ACTION_LABELS[action]}
        </Button>
      </div>
    </div>
  );
}
