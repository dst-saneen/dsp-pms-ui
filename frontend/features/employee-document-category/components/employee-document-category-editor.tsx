"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { EmployeeDocumentCategoryForm } from "../forms/employee-document-category-form";
import { useCreateEmployeeDocumentCategory } from "../hooks/use-create-employee-document-category";
import { useDeleteEmployeeDocumentCategory } from "../hooks/use-delete-employee-document-category";
import { useUpdateEmployeeDocumentCategory } from "../hooks/use-update-employee-document-category";
import { EMPLOYEE_DOCUMENT_CATEGORY_LIST } from "../lib/employee-document-category-navigation";
import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import type { EmployeeDocumentCategoryFormValues } from "../validation/employee-document-category-schema";

interface EmployeeDocumentCategoryEditorProps {
  mode: "create" | "edit";
  category?: EmployeeDocumentCategory | null;
  returnTo: string;
  canManage: boolean;
}

export function EmployeeDocumentCategoryEditor({
  mode,
  category = null,
  returnTo,
  canManage,
}: EmployeeDocumentCategoryEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateEmployeeDocumentCategory({
    suppressToast: true,
  });
  const updateMutation = useUpdateEmployeeDocumentCategory({
    suppressToast: true,
  });
  const deleteMutation = useDeleteEmployeeDocumentCategory();

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Category"
          : category
            ? `${category.categoryCode} ${category.categoryName}`
            : "Edit Category",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: EmployeeDocumentCategoryFormValues) => {
    setValidationErrors([]);

    if (mode === "edit" && category) {
      updateMutation.mutate(
        { id: category.id, data },
        {
          onSuccess: () => {
            toast.success("Document Category updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update Document Category."),
            );
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Document Category created successfully.", {
          action: {
            label: "Add type",
            onClick: () => router.push("/hr/employee-document-types/new"),
          },
        });
        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(
          getApiErrorMessage(error, "Unable to create Document Category."),
        );
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Document Category"
            : `Edit ${category?.categoryName ?? "Category"}`
        }
        description={
          mode === "create"
            ? "Create a category, then define document types under it."
            : "Update category details used by document types."
        }
        formId="employee-document-category-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(category)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <EmployeeDocumentCategoryForm
            category={category}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />
        </div>
      </EntityFormPage>

      {category ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Document Category"
          name={category.categoryName}
          code={category.categoryCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(category.id, {
              onSuccess: () => {
                router.push(EMPLOYEE_DOCUMENT_CATEGORY_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
