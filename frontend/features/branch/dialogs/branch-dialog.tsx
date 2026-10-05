"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

import { BranchForm } from "../forms/branch-form";

import { useCreateBranch } from "../hooks/use-create-branch";
import { useUpdateBranch } from "../hooks/use-update-branch";
import { useDeleteBranch } from "../hooks/use-delete-branch";

import type { Branch } from "../types/branch";
import {
  toBranchPayload,
  type BranchFormValues,
} from "../validation/branch-schema";

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
}

export function BranchDialog({
  open,
  onOpenChange,
  branch,
}: BranchDialogProps) {
  const createMutation = useCreateBranch();

  const updateMutation = useUpdateBranch();

  const deleteMutation = useDeleteBranch();

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const closeDialog = () => {
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = (
    data: BranchFormValues,
  ) => {
    const payload = toBranchPayload(data);

    if (branch) {
      updateMutation.mutate(
        {
          id: branch.id,
          data: payload,
        },
        {
          onSuccess: closeDialog,
        },
      );

      return;
    }

    createMutation.mutate(payload, {
      onSuccess: closeDialog,
    });
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          branch
            ? "Edit Branch"
            : "Create Branch"
        }
        description="Manage branch information"
        size="xl"
        footer={
          <div className="flex items-center justify-between">
            <div>
              {branch && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setDeleteOpen(true)
                  }
                >
                  Delete
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                form="branch-form"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : branch
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <BranchForm
          branch={branch}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </FormDialog>

      {branch && (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Branch"
          name={branch.branchName}
          code={branch.branchCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(branch.id, {
              onSuccess: closeDialog,
            })
          }
        />
      )}
    </>
  );
}