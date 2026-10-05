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
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage, isVersionConflictError } from "@/services/api-client";

import {
  useApprovePayrollRun,
  useCalculatePayrollRun,
  useCancelPayrollRun,
  useMarkPayrollRunPaid,
  useReturnPayrollRunToDraft,
} from "../hooks";
import type { PayrollRun, PayrollRunAction } from "../types";
import { useFinancePaymentAccounts } from "@/features/office-finance/hooks";

type ActionMode = Extract<
  PayrollRunAction,
  "CALCULATE" | "RETURN_TO_DRAFT" | "APPROVE" | "MARK_PAID" | "CANCEL"
>;

interface RunActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: PayrollRun | null;
  mode: ActionMode;
  onCompleted?: () => void;
}

const titles: Record<ActionMode, string> = {
  CALCULATE: "Calculate payroll",
  RETURN_TO_DRAFT: "Return to draft",
  APPROVE: "Approve payroll",
  MARK_PAID: "Mark paid",
  CANCEL: "Cancel payroll run",
};

export function RunActionDialog({
  open,
  onOpenChange,
  run,
  mode,
  onCompleted,
}: RunActionDialogProps) {
  const calculate = useCalculatePayrollRun();
  const returnToDraft = useReturnPayrollRunToDraft();
  const approve = useApprovePayrollRun();
  const markPaid = useMarkPayrollRunPaid();
  const cancel = useCancelPayrollRun();
  const accounts = useFinancePaymentAccounts();
  const [reason, setReason] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending =
    calculate.isPending ||
    returnToDraft.isPending ||
    approve.isPending ||
    markPaid.isPending ||
    cancel.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!run) return;

    if ((mode === "RETURN_TO_DRAFT" || mode === "CANCEL") && !reason.trim()) {
      setError("Reason is required.");
      return;
    }

    if (mode === "MARK_PAID" && (!paymentAccountId || !paymentReference.trim())) {
      setError("Payment account and reference are required.");
      return;
    }

    setError(null);

    try {
      if (mode === "CALCULATE") {
        await calculate.mutateAsync({
          id: run.id,
          data: { expectedVersion: run.version, operationId: createOperationId() },
        });
      }
      if (mode === "RETURN_TO_DRAFT") {
        await returnToDraft.mutateAsync({
          id: run.id,
          data: {
            expectedVersion: run.version,
            operationId: createOperationId(),
            reason: reason.trim(),
          },
        });
      }
      if (mode === "APPROVE") {
        await approve.mutateAsync({
          id: run.id,
          data: { expectedVersion: run.version, operationId: createOperationId() },
        });
      }
      if (mode === "MARK_PAID") {
        await markPaid.mutateAsync({
          id: run.id,
          data: {
            expectedVersion: run.version,
            operationId: createOperationId(),
            paymentAccountId,
            paidDate,
            paymentReference: paymentReference.trim(),
          },
        });
      }
      if (mode === "CANCEL") {
        await cancel.mutateAsync({
          id: run.id,
          data: {
            expectedVersion: run.version,
            operationId: createOperationId(),
            reason: reason.trim(),
          },
        });
      }
      setReason("");
      if (mode === "MARK_PAID") {
        setPaymentReference("");
      }
      onOpenChange(false);
      onCompleted?.();
    } catch (cause) {
      if (isVersionConflictError(cause)) {
        onCompleted?.();
      }
      setError(getApiErrorMessage(cause, "Action failed."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={titles[mode]}
      description={run?.runNumber}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="submit"
            form="payroll-run-action"
            variant={mode === "CANCEL" ? "destructive" : "default"}
            disabled={pending}
          >
            {pending ? "Processing…" : titles[mode]}
          </Button>
        </div>
      }
    >
      <form id="payroll-run-action" onSubmit={handleSubmit} className="space-y-3">
        {mode === "MARK_PAID" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="payroll-payment-account">Payment account</Label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                <SelectTrigger id="payroll-payment-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts.data?.items ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid-date">Paid date</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reference">Payment reference</Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {mode === "RETURN_TO_DRAFT" || mode === "CANCEL" ? (
          <>
            <Label htmlFor="run-reason">Reason</Label>
            <Input
              id="run-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Confirm this action for {run?.runNumber}.
          </p>
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
