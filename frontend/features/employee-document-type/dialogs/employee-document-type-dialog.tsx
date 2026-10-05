"use client";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/common/form-sheet";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import type { EmployeeDocumentTypeFormValues } from "../validation/employee-document-type-schema";

import { EmployeeDocumentTypeForm } from "../forms/employee-document-type-form";
import { useCreateEmployeeDocumentType } from "../hooks/use-create-employee-document-type";
import { useUpdateEmployeeDocumentType } from "../hooks/use-update-employee-document-type";

interface EmployeeDocumentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType?: EmployeeDocumentType | null;
}

export function EmployeeDocumentTypeDialog({
  open,
  onOpenChange,
  documentType,
}: EmployeeDocumentTypeDialogProps) {
  const isEdit = !!documentType;
  const createMutation = useCreateEmployeeDocumentType();
  const updateMutation = useUpdateEmployeeDocumentType();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (data: EmployeeDocumentTypeFormValues) => {
    if (isEdit && documentType) {
      updateMutation.mutate(
        { id: documentType.id, data },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Document Type" : "Add Document Type"}
      description={
        isEdit
          ? "Update employee document type."
          : "Create a new employee document type."
      }
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="employee-document-type-form"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      }
    >
      <EmployeeDocumentTypeForm
        documentType={documentType}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </FormSheet>
  );
}
