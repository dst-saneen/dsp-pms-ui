"use client";

import { useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";

import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

import { CompanyGroupForm } from "../forms/company-group-form";

import { useCreateCompanyGroup } from "../hooks/use-create-company-group";
import { useUpdateCompanyGroup } from "../hooks/use-update-company-group";
import { useDeleteCompanyGroup } from "../hooks/use-delete-company-group";

import type { CompanyGroup } from "../types/company-group";
import type { CompanyGroupFormValues } from "../validation/company-group-schema";

interface CompanyGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyGroup: CompanyGroup | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function CompanyGroupDialog({
  open,
  onOpenChange,
  companyGroup,
  returnFocusRef,
}: CompanyGroupDialogProps) {
  const createMutation =
    useCreateCompanyGroup();

  const updateMutation =
    useUpdateCompanyGroup();

  const deleteMutation =
    useDeleteCompanyGroup();

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
    data: CompanyGroupFormValues,
  ) => {
    if (companyGroup) {
      updateMutation.mutate(
        {
          id: companyGroup.id,
          data,
        },
        {
          onSuccess: closeDialog,
        },
      );

      return;
    }

    createMutation.mutate(data, {
      onSuccess: closeDialog,
    });
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          companyGroup
            ? "Edit Company Group"
            : "Create Company Group"
        }
        description="Manage company group information"
        size="lg"
        onCloseAutoFocus={(event) => {
          const returnTarget = returnFocusRef?.current;

          if (!returnTarget) return;

          event.preventDefault();
          returnTarget.focus();
        }}
        footer={
          <div className="flex items-center justify-between">
            <div>
              {companyGroup && (
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
                form="company-group-form"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : companyGroup
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <CompanyGroupForm
          companyGroup={companyGroup}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </FormDialog>

      {companyGroup && (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Company Group"
          name={companyGroup.groupName}
          code={companyGroup.groupCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(
              companyGroup.id,
              {
                onSuccess: closeDialog,
              },
            )
          }
        />
      )}
    </>
  );
}
