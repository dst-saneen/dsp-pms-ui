"use client";

import { useState } from "react";

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
import { getApiErrorMessage } from "@/services/api-client";

import { useSubmitMyOvertime } from "../hooks/use-my-workspace";
import type { MyOvertimeRequest } from "../types";

function minutesLabel(value?: number | null) {
  if (typeof value !== "number") return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function SubmitOvertimeSheet({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MyOvertimeRequest | null;
}) {
  const submit = useSubmitMyOvertime();
  const eligible = request?.eligibleMinutes ?? 0;
  const [minutes, setMinutes] = useState("");
  const [settlement, setSettlement] = useState("COMP_OFF");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!request) return;
    setError(null);
    const requestedMinutes = Number(minutes || eligible);
    if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
      setError("Requested minutes must be positive.");
      return;
    }
    if (requestedMinutes > eligible) {
      setError(`Cannot request more than eligible (${eligible} min).`);
      return;
    }
    try {
      await submit.mutateAsync({
        id: request.id,
        requestedMinutes,
        requestedSettlement: settlement,
        reason: reason.trim() || undefined,
      });
      setMinutes("");
      setReason("");
      onOpenChange(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Could not submit overtime."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          setMinutes("");
          setReason("");
        }
        onOpenChange(next);
      }}
      title="Submit overtime"
      description={
        request
          ? `${new Date(request.businessDate).toLocaleDateString()} · Eligible ${minutesLabel(eligible)}`
          : undefined
      }
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="submit-overtime-form"
            disabled={submit.isPending || !request || eligible <= 0}
            title={
              eligible <= 0
                ? "No eligible overtime minutes"
                : "Send to manager/HR for approval"
            }
          >
            {submit.isPending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      }
    >
      <form id="submit-overtime-form" className="space-y-4" onSubmit={onSubmit}>
        <p className="text-muted-foreground text-xs">
          Calculated overtime is not approved yet. Submit sends it to HR →
          Overtime. After Comp-off approve, credits appear under Leave →
          Comp-off.
        </p>
        <div className="space-y-2">
          <Label htmlFor="ot-minutes">Requested minutes (max {eligible})</Label>
          <Input
            id="ot-minutes"
            type="number"
            min={1}
            max={eligible || undefined}
            placeholder={String(eligible)}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Preferred settlement</Label>
          <Select value={settlement} onValueChange={setSettlement}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMP_OFF">Comp-off credit</SelectItem>
              <SelectItem value="PAYROLL_PENDING">Payroll pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ot-reason">Reason (optional)</Label>
          <Input
            id="ot-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
