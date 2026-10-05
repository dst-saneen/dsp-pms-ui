"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

import { CompanyForm } from "../forms/company-form";

import { useCreateCompany } from "../hooks/use-create-company";
import { useUpdateCompany } from "../hooks/use-update-company";
import { useDeleteCompany } from "../hooks/use-delete-company";

import type { Company } from "../types/company";
import type { CompanyFormValues } from "../validation/company-schema";

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
}

export function CompanyDialog({
  open,
  onOpenChange,
  company,
}: CompanyDialogProps) {

    const createMutation = useCreateCompany();

    const updateMutation = useUpdateCompany();

    const deleteMutation = useDeleteCompany();

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
        data: CompanyFormValues,
        ) => {
        const dto = {
            ...data,

            companyGroupId:
            data.companyGroupId || undefined,

            parentCompanyId:
            data.parentCompanyId || undefined,
        };

        if (company) {
            updateMutation.mutate(
            {
                id: company.id,
                data: dto,
            },
            {
                onSuccess: closeDialog,
            },
            );

            return;
        }

        createMutation.mutate(dto, {
            onSuccess: closeDialog,
        });
    };

return (
  <>
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        company
          ? "Edit Company"
          : "Create Company"
      }
      description="Manage company information"
      size="2xl"
      footer={
        <div className="flex items-center justify-between">
          <div>
            {company && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
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
              form="company-form"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : company
                  ? "Update"
                  : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <CompanyForm
        company={company}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </FormDialog>

    {company && (
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Company"
        name={company.companyName}
        code={company.companyCode}
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(company.id, {
            onSuccess: closeDialog,
          })
        }
      />
    )}
  </>
);
}