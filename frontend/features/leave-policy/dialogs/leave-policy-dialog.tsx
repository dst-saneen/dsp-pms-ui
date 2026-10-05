"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormDialog } from "@/components/common/form-dialog";
import { Button } from "@/components/ui/button";

import { LeavePolicyForm } from "../forms/leave-policy-form";
import {
  useCreateLeavePolicy,
  useDeleteLeavePolicy,
  useUpdateLeavePolicy,
} from "../hooks/use-leave-policies";
import type { LeavePolicy } from "../types/leave-policy";
import type { LeavePolicyFormValues } from "../validation/leave-policy-schema";

interface LeavePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leavePolicy: LeavePolicy | null;
}

function toDto(data: LeavePolicyFormValues) {
  const carry = data.carryForwardLimit?.trim();
  const maxDays = data.maxConsecutiveDays?.trim();
  const branchId = data.branchId?.trim() || null;
  return {
    companyId: data.companyId,
    branchId,
    departmentId: branchId ? data.departmentId || null : null,
    designationId: branchId ? data.designationId || null : null,
    leaveTypeId: data.leaveTypeId,
    annualEntitlement: Number(data.annualEntitlement),
    carryForwardLimit: carry ? Number(carry) : undefined,
    maxConsecutiveDays: maxDays ? Number(maxDays) : undefined,
    allowNegativeBalance: data.allowNegativeBalance,
  };
}

export function LeavePolicyDialog({ open, onOpenChange, leavePolicy }: LeavePolicyDialogProps) {
  const createMutation = useCreateLeavePolicy();
  const updateMutation = useUpdateLeavePolicy();
  const deleteMutation = useDeleteLeavePolicy();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const closeDialog = () => {
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = (data: LeavePolicyFormValues) => {
    const dto = toDto(data);
    if (leavePolicy) {
      updateMutation.mutate({ id: leavePolicy.id, data: dto }, { onSuccess: closeDialog });
      return;
    }
    createMutation.mutate(dto, { onSuccess: closeDialog });
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={leavePolicy ? "Edit Leave Policy" : "Create Leave Policy"}
        description="Leave blank branch for a company default. Branch, department, and designation overrides win over that default. Enter leave days per year."
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <div>
              {leavePolicy ? (
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="leave-policy-form" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <LeavePolicyForm leavePolicy={leavePolicy} onSubmit={handleSubmit} />
      </FormDialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete leave policy?"
        name={leavePolicy?.leaveType?.leaveName ?? "Leave policy"}
        code={leavePolicy?.leaveType?.leaveCode}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!leavePolicy) return;
          deleteMutation.mutate(leavePolicy.id, { onSuccess: closeDialog });
        }}
      />
    </>
  );
}
