"use client";

import { useState, type FormEvent } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useApproveRegularization,
  useRejectRegularization,
} from "../hooks/use-attendance-exceptions";
import type { AttendanceRegularization } from "../types";

type ReviewMode = "approve" | "reject";

interface ReviewExceptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regularization: AttendanceRegularization | null;
  mode: ReviewMode;
}

function employeeLabel(regularization: AttendanceRegularization | null) {
  const employee = regularization?.employee;
  const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
  return name || employee?.employeeCode || "Employee";
}

export function ReviewExceptionSheet({
  open,
  onOpenChange,
  regularization,
  mode,
}: ReviewExceptionSheetProps) {
  const [remarks, setRemarks] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const approveMutation = useApproveRegularization();
  const rejectMutation = useRejectRegularization();
  const pending = approveMutation.isPending || rejectMutation.isPending;
  const title = mode === "approve" ? "Approve regularization" : "Reject regularization";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!regularization) return;
    if (mode === "reject" && !remarks.trim()) {
      setLocalError("A rejection reason is required.");
      return;
    }
    setLocalError(null);

    try {
      const payload = { id: regularization.id, remarks: remarks.trim() || undefined };
      if (mode === "approve") {
        await approveMutation.mutateAsync(payload);
      } else {
        await rejectMutation.mutateAsync(payload);
      }
      setRemarks("");
      onOpenChange(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Unable to process regularization."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRemarks("");
          setLocalError(null);
        }
        onOpenChange(next);
      }}
      title={title}
      description={`${employeeLabel(regularization)} · submitted regularization`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="review-regularization-form"
            variant={mode === "approve" ? "default" : "destructive"}
            disabled={pending || !regularization}
          >
            {pending ? "Processing…" : title}
          </Button>
        </div>
      }
    >
      <form id="review-regularization-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p>
            Proposed in {formatTime(regularization?.proposedCheckInAt)} · out{" "}
            {formatTime(regularization?.proposedCheckOutAt)}
          </p>
          {regularization?.attendanceException ? (
            <p className="mt-1 text-muted-foreground">
              {regularization.attendanceException.type} ·{" "}
              {formatDate(regularization.attendanceException.businessDate)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="regularization-remarks">
            {mode === "reject" ? "Rejection reason (required)" : "Remarks (optional)"}
          </Label>
          <Input
            id="regularization-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder={
              mode === "reject"
                ? "Explain why this regularization is rejected"
                : "Optional review note"
            }
            required={mode === "reject"}
          />
        </div>
        {localError ? <p className="text-destructive text-sm">{localError}</p> : null}
      </form>
    </FormSheet>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
