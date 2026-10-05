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

import { EmployeeDocumentVerificationPanel } from "./employee-document-verification-panel";
import { EmployeeDocumentForm } from "../forms/employee-document-form";
import { useCreateEmployeeDocument } from "../hooks/use-create-employee-document";
import { useDeleteEmployeeDocument } from "../hooks/use-delete-employee-document";
import { useUpdateEmployeeDocument } from "../hooks/use-update-employee-document";
import { EMPLOYEE_DOCUMENT_LIST } from "../lib/employee-document-navigation";
import type { EmployeeDocument } from "../types/employee-document";
import type { EmployeeDocumentFormValues } from "../validation/employee-document-schema";

interface EmployeeDocumentEditorProps {
  mode: "create" | "edit";
  document?: EmployeeDocument | null;
  defaultEmployeeId?: string;
  returnTo: string;
  canManage: boolean;
}

export function EmployeeDocumentEditor({
  mode,
  document = null,
  defaultEmployeeId,
  returnTo,
  canManage,
}: EmployeeDocumentEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<EmployeeDocument | null>(
    document,
  );

  const createMutation = useCreateEmployeeDocument({ suppressToast: true });
  const updateMutation = useUpdateEmployeeDocument({ suppressToast: true });
  const deleteMutation = useDeleteEmployeeDocument();

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Document"
          : activeDocument
            ? activeDocument.title
            : "Edit Document",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: EmployeeDocumentFormValues) => {
    setValidationErrors([]);

    if (mode === "edit" && activeDocument) {
      updateMutation.mutate(
        { id: activeDocument.id, data },
        {
          onSuccess: (updated) => {
            setActiveDocument(updated);
            toast.success("Document updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update Document."),
            );
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Document created successfully.");
        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Document."));
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Employee Document"
            : `Edit ${activeDocument?.title ?? "Document"}`
        }
        description={
          mode === "create"
            ? "Capture an employee document against a configured document type."
            : "Update document details and verification status."
        }
        formId="employee-document-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(activeDocument)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
      >
        <div className="space-y-6">
          <FormValidationSummary errors={validationErrors} />
          <EmployeeDocumentForm
            document={activeDocument}
            defaultEmployeeId={
              activeDocument ? undefined : defaultEmployeeId
            }
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />

          {activeDocument ? (
            <EmployeeDocumentVerificationPanel
              document={activeDocument}
              returnTo={returnTo}
              onDocumentChange={setActiveDocument}
            />
          ) : null}
        </div>
      </EntityFormPage>

      {activeDocument ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Employee Document"
          name={activeDocument.title}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(activeDocument.id, {
              onSuccess: () => {
                toast.success("Document deleted successfully.");
                router.push(EMPLOYEE_DOCUMENT_LIST);
              },
              onError: (error) => {
                toast.error(
                  getApiErrorMessage(error, "Unable to delete Document."),
                );
              },
            })
          }
        />
      ) : null}
    </>
  );
}
