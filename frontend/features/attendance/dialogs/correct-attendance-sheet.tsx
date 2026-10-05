"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";

import { useCorrectAttendance } from "../hooks/use-attendance-list";
import type { AttendanceRecord } from "../types/attendance";

interface CorrectAttendanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceRecord | null;
}

function toLocalInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CorrectAttendanceForm({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceRecord;
}) {
  const [checkInTime, setCheckInTime] = useState(() =>
    toLocalInputValue(record.checkInTime),
  );
  const [checkOutTime, setCheckOutTime] = useState(() =>
    toLocalInputValue(record.checkOutTime),
  );
  const [status, setStatus] = useState(record.status || "PRESENT");
  const [correctionReason, setCorrectionReason] = useState("");
  const [remarks, setRemarks] = useState(record.remarks ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const correctMutation = useCorrectAttendance();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!correctionReason.trim()) {
      setLocalError("Correction reason is required.");
      return;
    }

    try {
      await correctMutation.mutateAsync({
        id: record.id,
        data: {
          checkInTime: checkInTime
            ? new Date(checkInTime).toISOString()
            : undefined,
          checkOutTime: checkOutTime
            ? new Date(checkOutTime).toISOString()
            : undefined,
          status,
          correctionReason: correctionReason.trim(),
          remarks: remarks.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Correction failed."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Correct attendance"
      description={`Current in ${toLocalInputValue(record.checkInTime) || "—"} · out ${toLocalInputValue(record.checkOutTime) || "—"}. Reason is required. Saving clears related exceptions — you do not need Propose fix / Approve after this.`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="correct-attendance-form"
            disabled={correctMutation.isPending}
          >
            {correctMutation.isPending ? "Saving…" : "Save correction"}
          </Button>
        </div>
      }
    >
      <form
        id="correct-attendance-form"
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="checkInTime">Check in</Label>
            <Input
              id="checkInTime"
              type="datetime-local"
              value={checkInTime}
              onChange={(event) => setCheckInTime(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkOutTime">Check out</Label>
            <Input
              id="checkOutTime"
              type="datetime-local"
              value={checkOutTime}
              onChange={(event) => setCheckOutTime(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {[
              "PRESENT",
              "ABSENT",
              "HALF_DAY",
              "LEAVE",
              "HOLIDAY",
              "WEEK_OFF",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="correctionReason">Correction reason</Label>
          <Input
            id="correctionReason"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remarks">Remarks</Label>
          <Input
            id="remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        {localError ? (
          <p className="text-destructive text-sm">{localError}</p>
        ) : null}
      </form>
    </FormSheet>
  );
}

export function CorrectAttendanceSheet({
  open,
  onOpenChange,
  record,
}: CorrectAttendanceSheetProps) {
  if (!record) {
    return null;
  }

  return (
    <CorrectAttendanceForm
      key={record.id}
      open={open}
      onOpenChange={onOpenChange}
      record={record}
    />
  );
}
