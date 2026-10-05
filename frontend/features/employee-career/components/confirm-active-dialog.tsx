"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ProbationConfirmationPreflight } from "../types/probation";

const OVERRIDE_REASON_MIN_LENGTH = 12;

interface ConfirmActiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preflight: ProbationConfirmationPreflight;
  loading?: boolean;
  onConfirm: (values: {
    confirmationDate: string;
    note: string;
    reference?: string;
    earlyOverrideReason?: string;
  }) => Promise<void>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function ConfirmActiveForm({
  preflight,
  loading,
  onOpenChange,
  onConfirm,
}: {
  preflight: ProbationConfirmationPreflight;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: ConfirmActiveDialogProps["onConfirm"];
}) {
  const [confirmationDate, setConfirmationDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [earlyOverrideReason, setEarlyOverrideReason] = useState("");

  const isEarlyOverride = Boolean(preflight.allowEarlyOverride && !preflight.canConfirm);
  const canSubmit =
    Boolean(note.trim()) &&
    Boolean(confirmationDate) &&
    (preflight.canConfirm ||
      (isEarlyOverride && earlyOverrideReason.trim().length >= OVERRIDE_REASON_MIN_LENGTH));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm employee as active</DialogTitle>
        <DialogDescription>
          Confirm probation completion for {preflight.employeeName} ({preflight.employeeCode}).
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Planned probation end</dt>
          <dd className="font-medium">{formatDate(preflight.plannedEndDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Earliest confirmation date</dt>
          <dd className="font-medium">{formatDate(preflight.earliestConfirmationDate)}</dd>
        </div>
      </dl>

      {!preflight.canConfirm && !preflight.allowEarlyOverride && preflight.blockedReason ? (
        <p className="text-muted-foreground rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm">
          {preflight.blockedReason}
        </p>
      ) : null}

      {isEarlyOverride ? (
        <div
          className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border px-3 py-2"
          role="alert"
        >
          <p className="text-destructive text-sm font-medium">
            This is an early confirmation (before planned end date).
          </p>
          <p className="text-muted-foreground text-sm">
            {preflight.blockedReason ??
              "Probation is not due yet. Enter a confirmation note and a structured override reason to continue."}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="confirmation-date">Actual confirmation date</Label>
          <Input
            id="confirmation-date"
            type="date"
            value={confirmationDate}
            onChange={(event) => setConfirmationDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation-note">Confirmation note</Label>
          <Textarea
            id="confirmation-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Record the probation confirmation decision."
            rows={3}
          />
        </div>
        {isEarlyOverride ? (
          <div className="space-y-2">
            <Label htmlFor="override-reason">Structured override reason</Label>
            <Textarea
              id="override-reason"
              value={earlyOverrideReason}
              onChange={(event) => setEarlyOverrideReason(event.target.value)}
              placeholder="Explain why active confirmation is required before the planned end date."
              rows={3}
            />
            {earlyOverrideReason.trim().length > 0 &&
            earlyOverrideReason.trim().length < OVERRIDE_REASON_MIN_LENGTH ? (
              <p className="text-destructive text-sm">
                Override reason must be at least {OVERRIDE_REASON_MIN_LENGTH} characters.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="confirmation-reference">Reference (optional)</Label>
          <Input
            id="confirmation-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Policy reference or ticket ID"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button
          disabled={loading || !canSubmit}
          onClick={() => {
            void onConfirm({
              confirmationDate,
              note: note.trim(),
              reference: reference.trim() || undefined,
              earlyOverrideReason: isEarlyOverride ? earlyOverrideReason.trim() : undefined,
            });
          }}
        >
          {loading ? "Confirming…" : isEarlyOverride ? "Confirm early" : "Confirm active"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ConfirmActiveDialog({
  open,
  onOpenChange,
  preflight,
  loading = false,
  onConfirm,
}: ConfirmActiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <ConfirmActiveForm
            key={preflight.employeeId}
            preflight={preflight}
            loading={loading}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
