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

import { EmployeeDocumentTypeForm } from "../forms/employee-document-type-form";
import { useCreateEmployeeDocumentType } from "../hooks/use-create-employee-document-type";
import { useDeleteEmployeeDocumentType } from "../hooks/use-delete-employee-document-type";
import { useUpdateEmployeeDocumentType } from "../hooks/use-update-employee-document-type";
import { EMPLOYEE_DOCUMENT_TYPE_LIST } from "../lib/employee-document-type-navigation";
import type { EmployeeDocumentType } from "../types/employee-document-type";
import type { EmployeeDocumentTypeFormValues } from "../validation/employee-document-type-schema";

interface EmployeeDocumentTypeEditorProps {
  mode: "create" | "edit";
  documentType?: EmployeeDocumentType | null;
  returnTo: string;
  canManage: boolean;
}

export function EmployeeDocumentTypeEditor({
  mode,
  documentType = null,
  returnTo,
  canManage,
}: EmployeeDocumentTypeEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateEmployeeDocumentType({ suppressToast: true });
  const updateMutation = useUpdateEmployeeDocumentType({ suppressToast: true });
  const deleteMutation = useDeleteEmployeeDocumentType();

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Document Type"
          : documentType
            ? `${documentType.documentCode} ${documentType.documentName}`
            : "Edit Document Type",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: EmployeeDocumentTypeFormValues) => {
    setValidationErrors([]);

    if (mode === "edit" && documentType) {
      updateMutation.mutate(
        { id: documentType.id, data },
        {
          onSuccess: () => {
            toast.success("Document Type updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update Document Type."),
            );
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Document Type created successfully.", {
          action: {
            label: "Add document",
            onClick: () => router.push("/hr/employee-documents/new"),
          },
        });
        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(
          getApiErrorMessage(error, "Unable to create Document Type."),
        );
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Document Type"
            : `Edit ${documentType?.documentName ?? "Document Type"}`
        }
        description={
          mode === "create"
            ? "Define a document type under a category. Employee documents come next."
            : "Update document type requirements and status."
        }
        formId="employee-document-type-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(documentType)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <EmployeeDocumentTypeForm
            documentType={documentType}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />
        </div>
      </EntityFormPage>

      {documentType ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Document Type"
          name={documentType.documentName}
          code={documentType.documentCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(documentType.id, {
              onSuccess: () => {
                router.push(EMPLOYEE_DOCUMENT_TYPE_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
