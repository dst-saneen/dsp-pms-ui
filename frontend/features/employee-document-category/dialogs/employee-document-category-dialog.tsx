"use client";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/common/form-sheet";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import type { EmployeeDocumentCategoryFormValues } from "../validation/employee-document-category-schema";

import { EmployeeDocumentCategoryForm } from "../forms/employee-document-category-form";
import { useCreateEmployeeDocumentCategory } from "../hooks/use-create-employee-document-category";
import { useUpdateEmployeeDocumentCategory } from "../hooks/use-update-employee-document-category";

interface EmployeeDocumentCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: EmployeeDocumentCategory | null;
}

export function EmployeeDocumentCategoryDialog({
  open,
  onOpenChange,
  category,
}: EmployeeDocumentCategoryDialogProps) {
  const isEdit = !!category;
  const createMutation = useCreateEmployeeDocumentCategory();
  const updateMutation = useUpdateEmployeeDocumentCategory();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (data: EmployeeDocumentCategoryFormValues) => {
    if (isEdit && category) {
      updateMutation.mutate(
        { id: category.id, data },
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
      title={isEdit ? "Edit Document Category" : "Add Document Category"}
      description={
        isEdit ? "Update document category." : "Create a new document category."
      }
      size="md"
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
            form="employee-document-category-form"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      }
    >
      <EmployeeDocumentCategoryForm
        category={category}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </FormSheet>
  );
}
