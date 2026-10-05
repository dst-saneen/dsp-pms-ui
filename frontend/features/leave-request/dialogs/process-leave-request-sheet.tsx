"use client";

import { useState } from "react";
import Link from "next/link";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useApproveLeaveRequest,
  useCancelLeaveRequest,
  useRejectLeaveRequest,
} from "../hooks/use-leave-requests";
import type { LeaveRequest } from "../types/leave-request";

type ProcessMode = "approve" | "reject" | "cancel";

interface ProcessLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest | null;
  mode: ProcessMode;
}

function employeeName(request: LeaveRequest | null) {
  if (!request?.employee) return "Employee";
  return (
    [request.employee.firstName, request.employee.lastName]
      .filter(Boolean)
      .join(" ") ||
    request.employee.employeeCode ||
    "Employee"
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProcessLeaveRequestSheet({
  open,
  onOpenChange,
  request,
  mode,
}: ProcessLeaveRequestSheetProps) {
  const [remarks, setRemarks] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();
  const cancelMutation = useCancelLeaveRequest();

  const pending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    cancelMutation.isPending;
  const canAct = Boolean(request?.approvalProgress?.canAct);
  const isFinalHrApprove =
    mode === "approve" && Boolean(request?.approvalProgress?.isFinalStep);
  const progress = request?.approvalProgress;

  const titles: Record<ProcessMode, string> = {
    approve: isFinalHrApprove ? "Approve leave (HR)" : "Approve leave",
    reject: "Reject leave",
    cancel: "Cancel leave",
  };

  async function runAction() {
    if (!request) return;
    setLocalError(null);

    if (mode === "reject" && !remarks.trim()) {
      setLocalError("Rejection remarks are required.");
      return;
    }

    try {
      if (mode === "approve") {
        await approveMutation.mutateAsync({
          id: request.id,
          remarks: remarks.trim() || undefined,
        });
      } else if (mode === "reject") {
        await rejectMutation.mutateAsync({
          id: request.id,
          remarks: remarks.trim(),
        });
      } else {
        await cancelMutation.mutateAsync({
          id: request.id,
          reason: remarks.trim() || undefined,
        });
      }
      setRemarks("");
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Action failed."));
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canAct && mode !== "cancel") return;
    if (isFinalHrApprove) {
      setConfirmOpen(true);
      return;
    }
    void runAction();
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setRemarks("");
            setLocalError(null);
            setConfirmOpen(false);
          }
          onOpenChange(next);
        }}
        title={canAct ? titles[mode] : "View leave request"}
        description={`${employeeName(request)} · ${request?.leaveType?.leaveName ?? "Leave"}`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {canAct || mode === "cancel" ? (
              <Button
                type="submit"
                form="process-leave-form"
                variant={mode === "approve" ? "default" : "destructive"}
                disabled={pending || !request}
                title={
                  isFinalHrApprove
                    ? "Final approval — this consumes reserved leave days once"
                    : mode === "approve"
                      ? "Approve your stage only — balance stays reserved until HR final"
                      : undefined
                }
              >
                {pending ? "Working…" : titles[mode]}
              </Button>
            ) : null}
          </div>
        }
      >
        <form
          id="process-leave-form"
          className="space-y-4"
          onSubmit={handleSubmit}
        >
          {request ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
              <p>
                {formatDate(request.fromDate)} – {formatDate(request.toDate)}
              </p>
              <p className="text-muted-foreground">
                {request.requestedDays} business day
                {Number(request.requestedDays) === 1 ? "" : "s"}
                {request.isHalfDay ? " · Half day" : " · Full day"} ·{" "}
                {request.status}
              </p>
              <p className="font-medium">
                {progress?.stage === "MANAGER_REVIEW"
                  ? "Waiting on: Manager"
                  : progress?.stage === "HR_REVIEW"
                    ? "Waiting on: HR (final)"
                    : progress?.stage === "APPROVED"
                      ? "Fully approved"
                      : progress?.stage === "REJECTED"
                        ? "Rejected"
                        : progress?.currentStepName
                          ? `Stage: ${progress.currentStepName}`
                          : `Status: ${request.status}`}
              </p>
              {progress?.currentStepName ? (
                <p className="text-muted-foreground text-xs">
                  Current step: {progress.currentStepName}
                  {progress.previousStepName
                    ? ` · Previous: ${progress.previousStepName}`
                    : ""}
                  {progress.isFinalStep ? " · This is the final step" : ""}
                </p>
              ) : null}
              {!canAct && mode !== "cancel" ? (
                <p className="text-amber-800 text-xs">
                  You cannot act on this request right now — it is not your
                  approval stage. Open{" "}
                  <Link className="underline" href="/hr/leave">
                    Leave requests
                  </Link>{" "}
                  → Manager review or HR review for your queue.
                </p>
              ) : null}
              {progress?.balancePreview ? (
                <p className="text-muted-foreground text-xs">
                  Balance {progress.balancePreview.available} available,{" "}
                  {progress.balancePreview.pending} pending
                  {mode === "approve" && progress.isFinalStep
                    ? ` → after final approve used ${progress.balancePreview.afterApprove.used} (pending cleared)`
                    : mode === "approve"
                      ? " → manager approve keeps days reserved (pending unchanged)"
                      : mode === "reject"
                        ? ` → after reject available ${progress.balancePreview.afterReject.available}`
                        : ""}
                </p>
              ) : null}
              {request.reason ? <p>{request.reason}</p> : null}
              <p className="text-muted-foreground text-xs">
                After final approval, check{" "}
                <Link className="underline" href="/hr/leave/calendar">
                  Leave calendar
                </Link>{" "}
                and the employee{" "}
                <Link className="underline" href="/my-workspace/calendar">
                  My calendar
                </Link>
                .
              </p>
            </div>
          ) : null}

          {canAct || mode === "cancel" ? (
            <div className="space-y-2">
              <Label htmlFor="remarks">
                {mode === "reject"
                  ? "Rejection remarks"
                  : "Remarks (optional)"}
              </Label>
              <Input
                id="remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={
                  mode === "reject"
                    ? "Required reason for rejection"
                    : "Optional note"
                }
              />
            </div>
          ) : null}

          {localError ? (
            <p className="text-destructive text-sm">{localError}</p>
          ) : null}
        </form>
      </FormSheet>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm HR approval"
        message="This is the final HR approval. The reserved days will be consumed."
        name={employeeName(request)}
        code={request?.leaveType?.leaveCode}
        nameLabel="Employee"
        codeLabel="Leave type"
        loading={pending}
        confirmLabel="Approve leave"
        onConfirm={() => void runAction()}
      />
    </>
  );
}
