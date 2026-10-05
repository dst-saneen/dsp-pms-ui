"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/common/form-sheet";
import { getApiErrorMessage } from "@/services/api-client";

import type { EmployeeDocument } from "../types/employee-document";
import type { EmployeeDocumentFormValues } from "../validation/employee-document-schema";

import { EmployeeDocumentForm } from "../forms/employee-document-form";
import { useCreateEmployeeDocument } from "../hooks/use-create-employee-document";
import { useUpdateEmployeeDocument } from "../hooks/use-update-employee-document";
import { employeeDocumentDetailHref } from "../lib/employee-document-navigation";

interface EmployeeDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: EmployeeDocument;
  defaultEmployeeId?: string;
  onDocumentChange?: (document: EmployeeDocument) => void;
}

export function EmployeeDocumentDialog(props: EmployeeDocumentDialogProps) {
  const key = props.document
    ? `${props.document.id}:${props.document.updatedAt}`
    : "new";

  return <EmployeeDocumentDialogContent key={key} {...props} />;
}

function EmployeeDocumentDialogContent({
  open,
  onOpenChange,
  document,
  defaultEmployeeId,
  onDocumentChange,
}: EmployeeDocumentDialogProps) {
  const isEdit = !!document;
  const [activeDocument, setActiveDocument] = useState<
    EmployeeDocument | undefined
  >(document);

  const createMutation = useCreateEmployeeDocument();
  const updateMutation = useUpdateEmployeeDocument();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (data: EmployeeDocumentFormValues) => {
    if (isEdit && activeDocument) {
      updateMutation.mutate(
        { id: activeDocument.id, data },
        {
          onSuccess: (updated) => {
            setActiveDocument(updated);
            onDocumentChange?.(updated);
            toast.success("Document updated successfully.");
            onOpenChange(false);
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
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Document."));
      },
    });
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Document" : "Add Document"}
      description={
        isEdit ? "Update employee document." : "Create a new employee document."
      }
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          {activeDocument ? (
            <Button type="button" variant="secondary" asChild>
              <Link
                href={employeeDocumentDetailHref(activeDocument.id)}
                onClick={() => onOpenChange(false)}
              >
                Open detail / verify
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="employee-document-form"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <EmployeeDocumentForm
          document={activeDocument}
          defaultEmployeeId={defaultEmployeeId}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
        {activeDocument ? (
          <p className="text-sm text-muted-foreground">
            Verify, reject with a reason, or reset from the{" "}
            <Link
              className="underline underline-offset-4"
              href={employeeDocumentDetailHref(activeDocument.id)}
              onClick={() => onOpenChange(false)}
            >
              document detail page
            </Link>
            .
          </p>
        ) : null}
      </div>
    </FormSheet>
  );
}
