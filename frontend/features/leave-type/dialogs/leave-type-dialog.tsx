"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormDialog } from "@/components/common/form-dialog";
import { Button } from "@/components/ui/button";

import { LeaveTypeForm } from "../forms/leave-type-form";
import {
  useCreateLeaveType,
  useDeleteLeaveType,
  useUpdateLeaveType,
} from "../hooks/use-leave-types";
import type { LeaveType } from "../types/leave-type";
import type { LeaveTypeFormValues } from "../validation/leave-type-schema";

interface LeaveTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveType: LeaveType | null;
  defaultCompanyId?: string;
}

export function LeaveTypeDialog({
  open,
  onOpenChange,
  leaveType,
  defaultCompanyId = "",
}: LeaveTypeDialogProps) {
  const createMutation = useCreateLeaveType();
  const updateMutation = useUpdateLeaveType();
  const deleteMutation = useDeleteLeaveType();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const closeDialog = () => {
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = (data: LeaveTypeFormValues) => {
    if (leaveType) {
      const { companyId: _unusedCompanyId, leaveCode: _unusedCode, ...updateData } =
        data;
      void _unusedCompanyId;
      void _unusedCode;
      updateMutation.mutate(
        { id: leaveType.id, data: updateData },
        { onSuccess: closeDialog },
      );
      return;
    }
    const { leaveCode: _omitCode, ...createData } = data;
    void _omitCode;
    createMutation.mutate(createData, { onSuccess: closeDialog });
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={leaveType ? "Edit Leave Type" : "Create Leave Type"}
        description="Leave types are company-specific. Each company keeps its own codes and rules."
        size="md"
        footer={
          <div className="flex items-center justify-between">
            <div>
              {leaveType ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="leave-type-form" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <LeaveTypeForm
          key={leaveType?.id ?? "create"}
          leaveType={leaveType}
          defaultCompanyId={defaultCompanyId}
          onSubmit={handleSubmit}
        />
      </FormDialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete leave type?"
        name={leaveType?.leaveName ?? ""}
        code={leaveType?.leaveCode}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!leaveType) return;
          deleteMutation.mutate(leaveType.id, { onSuccess: closeDialog });
        }}
      />
    </>
  );
}
