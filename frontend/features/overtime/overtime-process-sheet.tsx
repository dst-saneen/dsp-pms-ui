"use client";

import { useState } from "react";
import Link from "next/link";

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

import { useApproveOvertime, useCancelOvertime, useRejectOvertime } from "./hooks";
import type { OvertimeRequest } from "./types";

type ProcessMode = "approve" | "reject" | "cancel";

function minutesLabel(value?: number | null) {
  if (typeof value !== "number") return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m (${value} min)` : `${value} min`;
}

export function OvertimeProcessSheet({
  open,
  onOpenChange,
  request,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: OvertimeRequest | null;
  mode: ProcessMode;
}) {
  const [remarks, setRemarks] = useState("");
  const [approvedMinutes, setApprovedMinutes] = useState("");
  const [settlement, setSettlement] = useState("PAYROLL_PENDING");
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveOvertime();
  const reject = useRejectOvertime();
  const cancel = useCancelOvertime();
  const pending = approve.isPending || reject.isPending || cancel.isPending;
  const title =
    mode === "approve"
      ? "Approve overtime"
      : mode === "reject"
        ? "Reject overtime"
        : "Cancel overtime";

  const eligible = request?.eligibleMinutes ?? null;
  const requested = request?.requestedMinutes ?? 0;
  const maxApproving =
    typeof eligible === "number" ? Math.min(eligible, requested || eligible) : requested;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) return;
    setError(null);
    const message = remarks.trim();
    if (mode === "reject" && !message) {
      setError("Rejection remarks are required.");
      return;
    }
    const minutes = Number(approvedMinutes || request.requestedMinutes);
    if (mode === "approve" && (!Number.isFinite(minutes) || minutes <= 0)) {
      setError("Approved minutes must be positive.");
      return;
    }
    if (mode === "approve" && typeof eligible === "number" && minutes > eligible) {
      setError(`Cannot approve more than eligible minutes (${eligible}).`);
      return;
    }
    try {
      if (mode === "approve") {
        await approve.mutateAsync({
          id: request.id,
          data: {
            approvedMinutes: minutes,
            approvedSettlement: settlement,
            remarks: message || undefined,
          },
        });
      }
      if (mode === "reject") {
        await reject.mutateAsync({ id: request.id, remarks: message });
      }
      if (mode === "cancel") {
        await cancel.mutateAsync({
          id: request.id,
          reason: message || undefined,
        });
      }
      onOpenChange(false);
      setRemarks("");
      setApprovedMinutes("");
      setSettlement("PAYROLL_PENDING");
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Action failed."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRemarks("");
          setApprovedMinutes("");
          setSettlement("PAYROLL_PENDING");
          setError(null);
        }
        onOpenChange(next);
      }}
      title={title}
      description={
        request
          ? `${request.employee?.employeeCode ?? request.employeeId} · ${request.businessDate.slice(0, 10)}`
          : undefined
      }
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            form="overtime-process-form"
            type="submit"
            variant={mode === "approve" ? "default" : "destructive"}
            disabled={pending || !request}
            title={
              mode === "approve"
                ? settlement === "COMP_OFF"
                  ? "Creates one Comp-off credit after approve"
                  : "Marks time for payroll — no Comp-off credit"
                : undefined
            }
          >
            {pending ? "Working…" : title}
          </Button>
        </div>
      }
    >
      <form id="overtime-process-form" className="space-y-4" onSubmit={submit}>
        {request ? (
          <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-sm">
            <p>Eligible: {minutesLabel(eligible)}</p>
            <p>Requested: {minutesLabel(requested)}</p>
            <p className="text-muted-foreground text-xs">
              Comp-off eligibility and credit size follow the employee&apos;s Company or Branch
              overtime policy. The policy is validated when you approve. Credits:{" "}
              <Link className="underline" href="/hr/leave/comp-off">
                Leave → Comp-off
              </Link>
              .
            </p>
          </div>
        ) : null}
        {mode === "approve" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="approved-minutes">Approved minutes</Label>
              <Input
                id="approved-minutes"
                type="number"
                min="1"
                max={maxApproving || undefined}
                value={approvedMinutes}
                placeholder={String(request?.requestedMinutes ?? "")}
                onChange={(event) => setApprovedMinutes(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement (choose one)</Label>
              <Select
                value={settlement}
                onValueChange={(value) => {
                  setError(null);
                  setSettlement(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYROLL_PENDING">
                    Payroll pending (pay, no Comp-off)
                  </SelectItem>
                  <SelectItem value="COMP_OFF">Comp-off credit (policy validated)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="overtime-remarks">
            {mode === "reject"
              ? "Rejection remarks"
              : mode === "cancel"
                ? "Cancellation reason"
                : "Remarks (optional)"}
          </Label>
          <Input
            id="overtime-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
