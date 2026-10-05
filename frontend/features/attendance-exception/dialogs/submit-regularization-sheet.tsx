"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyExceptionType } from "@/features/attendance/lib/attendance-labels";
import { getApiErrorMessage } from "@/services/api-client";

export interface RegularizeExceptionTarget {
  id: string;
  type: string;
  businessDate: string;
  attendanceId: string;
  status: string;
}

interface SubmitRegularizationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exception: RegularizeExceptionTarget | null;
  onSubmit: (input: {
    attendanceId: string;
    attendanceExceptionId: string;
    proposedCheckInAt: string;
    proposedCheckOutAt: string;
    reason: string;
  }) => Promise<unknown>;
}

function datePart(value: string) {
  return value.slice(0, 10);
}

export function SubmitRegularizationSheet({
  open,
  onOpenChange,
  exception,
  onSubmit,
}: SubmitRegularizationSheetProps) {
  const businessDate = exception ? datePart(exception.businessDate) : "";
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setCheckInTime("");
    setCheckOutTime("");
    setReason("");
    setLocalError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!exception?.attendanceId) {
      setLocalError("This exception has no attendance record to regularize.");
      return;
    }
    if (!reason.trim()) {
      setLocalError("Reason is required.");
      return;
    }
    if (!checkInTime || !checkOutTime) {
      setLocalError("Proposed check-in and check-out times are required.");
      return;
    }

    setPending(true);
    setLocalError(null);
    try {
      await onSubmit({
        attendanceId: exception.attendanceId,
        attendanceExceptionId: exception.id,
        proposedCheckInAt: new Date(
          `${businessDate}T${checkInTime}:00`,
        ).toISOString(),
        proposedCheckOutAt: new Date(
          `${businessDate}T${checkOutTime}:00`,
        ).toISOString(),
        reason: reason.trim(),
      });
      toast.success("Proposed fix submitted for approval.");
      handleOpenChange(false);
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, "Could not submit the proposed fix."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Propose a fix"
      description={
        exception
          ? `${friendlyExceptionType(exception.type).label} · ${businessDate}. This does not change attendance until someone Approves.`
          : "Suggest corrected check-in / check-out times for approval."
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="submit-regularization-form"
            disabled={pending || !exception}
          >
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      }
    >
      <form
        id="submit-regularization-form"
        className="space-y-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reg-in">Proposed check in</Label>
            <Input
              id="reg-in"
              type="time"
              value={checkInTime}
              onChange={(event) => setCheckInTime(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-out">Proposed check out</Label>
            <Input
              id="reg-out"
              type="time"
              value={checkOutTime}
              onChange={(event) => setCheckOutTime(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-reason">Reason</Label>
          <Input
            id="reg-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        {localError ? (
          <p className="text-destructive text-sm">{localError}</p>
        ) : null}
      </form>
    </FormSheet>
  );
}
