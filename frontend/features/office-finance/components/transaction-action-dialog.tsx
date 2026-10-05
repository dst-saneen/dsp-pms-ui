"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage, isVersionConflictError } from "@/services/api-client";

import {
  useApproveFinanceTransaction,
  useCancelFinanceTransaction,
  useReturnFinanceTransaction,
  useReverseFinanceTransaction,
  useSubmitFinanceTransaction,
} from "../hooks";
import type { FinanceTransaction, FinanceTransactionAction } from "../types";

type ActionMode = Extract<
  FinanceTransactionAction,
  "SUBMIT" | "APPROVE" | "RETURN" | "CANCEL" | "REVERSE"
>;

interface TransactionActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinanceTransaction | null;
  mode: ActionMode;
  onCompleted?: () => void;
}

const titles: Record<ActionMode, string> = {
  SUBMIT: "Submit transaction",
  APPROVE: "Approve transaction",
  RETURN: "Return to draft",
  CANCEL: "Cancel transaction",
  REVERSE: "Reverse transaction",
};

const confirmLabels: Record<ActionMode, string> = {
  SUBMIT: "Submit",
  APPROVE: "Approve",
  RETURN: "Return",
  CANCEL: "Cancel",
  REVERSE: "Reverse",
};

export function TransactionActionDialog({
  open,
  onOpenChange,
  transaction,
  mode,
  onCompleted,
}: TransactionActionDialogProps) {
  const submit = useSubmitFinanceTransaction();
  const approve = useApproveFinanceTransaction();
  const returnToDraft = useReturnFinanceTransaction();
  const cancel = useCancelFinanceTransaction();
  const reverse = useReverseFinanceTransaction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requiresReason = mode === "RETURN" || mode === "CANCEL" || mode === "REVERSE";
  const pending =
    submit.isPending ||
    approve.isPending ||
    returnToDraft.isPending ||
    cancel.isPending ||
    reverse.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!transaction) return;
    if (requiresReason && !reason.trim()) {
      setError("Reason is required.");
      return;
    }

    setError(null);
    const payload = {
      expectedVersion: transaction.version,
      operationId: createOperationId(),
      reason: reason.trim() || undefined,
    };

    try {
      if (mode === "SUBMIT") await submit.mutateAsync({ id: transaction.id, data: payload });
      if (mode === "APPROVE") await approve.mutateAsync({ id: transaction.id, data: payload });
      if (mode === "RETURN")
        await returnToDraft.mutateAsync({ id: transaction.id, data: payload });
      if (mode === "CANCEL") await cancel.mutateAsync({ id: transaction.id, data: payload });
      if (mode === "REVERSE") await reverse.mutateAsync({ id: transaction.id, data: payload });
      setReason("");
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
      description={transaction?.transactionNumber}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="submit"
            form="finance-transaction-action"
            variant={mode === "CANCEL" || mode === "REVERSE" ? "destructive" : "default"}
            disabled={pending}
          >
            {pending ? "Processing…" : confirmLabels[mode]}
          </Button>
        </div>
      }
    >
      <form id="finance-transaction-action" onSubmit={handleSubmit} className="space-y-3">
        {requiresReason ? (
          <>
            <Label htmlFor="action-reason">Reason</Label>
            <Input
              id="action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Confirm this action for {transaction?.description}.
          </p>
        )}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
