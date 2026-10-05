"use client";

import { useMemo, useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShifts } from "@/features/shift/hooks/use-shifts";
import { getApiErrorMessage } from "@/services/api-client";

import { useOverrideShiftRosterEntry } from "../hooks/use-shift-rosters";
import { friendlyDayLabel } from "../labels";
import type { ShiftRoster, ShiftRosterEntry } from "../types";

interface OverrideEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: ShiftRoster | null;
  entry: ShiftRosterEntry | null;
}

const DAY_TYPES = [
  { value: "WORKING", label: "Working day" },
  { value: "WEEK_OFF", label: "Week off" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "SCHEDULED_HALF_DAY", label: "Half day" },
] as const;

const DAY_PORTIONS = [
  { value: "FULL_DAY", label: "Full day" },
  { value: "FIRST_HALF", label: "First half" },
  { value: "SECOND_HALF", label: "Second half" },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function personLabel(entry: ShiftRosterEntry) {
  const name = [entry.employee?.firstName, entry.employee?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || entry.employee?.employeeCode || "Employee";
}

export function OverrideEntrySheet({
  open,
  onOpenChange,
  roster,
  entry,
}: OverrideEntrySheetProps) {
  const [reason, setReason] = useState("");
  const [dayType, setDayType] = useState(entry?.dayType ?? "WORKING");
  const [dayPortion, setDayPortion] = useState(
    entry?.dayPortion ?? "FULL_DAY",
  );
  const [shiftId, setShiftId] = useState(entry?.shiftId ?? "");
  const [error, setError] = useState<string | null>(null);
  const override = useOverrideShiftRosterEntry();
  const shifts = useShifts(roster?.companyId, true);

  const shiftItems = useMemo(
    () =>
      (shifts.data ?? []).map((shift) => ({
        id: shift.id,
        label: shift.shiftName || shift.shiftCode || shift.id,
      })),
    [shifts.data],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!roster || !entry || !reason.trim()) {
      setError("Please enter a short reason for this change.");
      return;
    }

    setError(null);
    try {
      await override.mutateAsync({
        id: roster.id,
        input: {
          expectedVersion: roster.version,
          shiftRosterEntryId: entry.id,
          reason: reason.trim(),
          newSnapshot: {
            dayType,
            dayPortion,
            shiftId: dayType === "WORKING" ? shiftId || null : null,
            scheduledStartAt: entry.scheduledStartAt ?? null,
            scheduledEndAt: entry.scheduledEndAt ?? null,
          },
        },
      });
      onOpenChange(false);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Could not save this day change."),
      );
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Change this day"
      description={
        entry
          ? `${personLabel(entry)} · ${formatDate(entry.workDate)} · currently ${friendlyDayLabel(entry.dayType, entry.dayPortion)}`
          : "Adjust one person’s day on this schedule."
      }
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
            form="override-roster-entry"
            disabled={override.isPending || !entry}
          >
            {override.isPending ? "Saving…" : "Save change"}
          </Button>
        </div>
      }
    >
      <form
        id="override-roster-entry"
        className="space-y-4"
        onSubmit={submit}
      >
        <div className="space-y-2">
          <Label htmlFor="override-day-type">Day type</Label>
          <Select value={dayType} onValueChange={setDayType}>
            <SelectTrigger id="override-day-type">
              <SelectValue placeholder="Day type" />
            </SelectTrigger>
            <SelectContent>
              {DAY_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="override-day-portion">Portion of day</Label>
          <Select value={dayPortion} onValueChange={setDayPortion}>
            <SelectTrigger id="override-day-portion">
              <SelectValue placeholder="Portion" />
            </SelectTrigger>
            <SelectContent>
              {DAY_PORTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {dayType === "WORKING" ? (
          <div className="space-y-2">
            <Label htmlFor="override-shift">Shift</Label>
            <Select
              value={shiftId || "__none__"}
              onValueChange={(value) =>
                setShiftId(value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger id="override-shift">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No shift</SelectItem>
                {shiftItems.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Working days need a shift so attendance can match the schedule.
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason</Label>
          <Input
            id="override-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Local holiday, swapped shift, week off"
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
