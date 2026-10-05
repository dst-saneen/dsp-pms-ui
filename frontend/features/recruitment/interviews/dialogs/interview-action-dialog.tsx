"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { InterviewSession } from "../types/interview";
import { resolveLocalInterviewTimezone } from "../constants/interview-options";

interface InterviewActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: InterviewSession | null;
  mode: "reschedule" | "cancel";
  loading?: boolean;
  onConfirm: (values: {
    scheduledDate?: string;
    scheduledTime?: string;
    durationMinutes?: number;
    timezone?: string;
    reason: string;
  }) => void;
}

export function InterviewActionDialog({
  open,
  onOpenChange,
  session,
  mode,
  loading,
  onConfirm,
}: InterviewActionDialogProps) {
  const form = useForm({
    defaultValues: {
      scheduledDate: "",
      scheduledTime: "10:00",
      durationMinutes: 60,
      timezone: resolveLocalInterviewTimezone(),
      reason: "",
    },
  });

  useEffect(() => {
    if (!open || !session) return;
    const start = new Date(session.scheduledStartAt);
    form.reset({
      scheduledDate: Number.isNaN(start.getTime())
        ? ""
        : start.toISOString().slice(0, 10),
      scheduledTime: Number.isNaN(start.getTime())
        ? "10:00"
        : start.toTimeString().slice(0, 5),
      durationMinutes: Math.max(
        15,
        Math.round(
          (new Date(session.scheduledEndAt).getTime() - start.getTime()) / 60_000,
        ) || 60,
      ),
      timezone: session.timezone,
      reason: "",
    });
  }, [open, session, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "reschedule" ? "Reschedule interview" : "Cancel interview"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => onConfirm(values))}
        >
          {mode === "reschedule" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>New date</RequiredLabel>
                <Input type="date" {...form.register("scheduledDate")} />
              </div>
              <div className="space-y-2">
                <RequiredLabel>New time</RequiredLabel>
                <Input type="time" {...form.register("scheduledTime")} />
              </div>
              <div className="space-y-2">
                <RequiredLabel>Duration (min)</RequiredLabel>
                <Input
                  type="number"
                  min={15}
                  {...form.register("durationMinutes", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel>Timezone</RequiredLabel>
                <Input {...form.register("timezone")} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <RequiredLabel>Reason</RequiredLabel>
            <Textarea rows={4} {...form.register("reason")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading
                ? "Processing…"
                : mode === "reschedule"
                  ? "Reschedule"
                  : "Cancel interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
