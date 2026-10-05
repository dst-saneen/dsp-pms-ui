"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { DesignationForm } from "../forms/designation-form";
import { useCreateDesignation } from "../hooks/use-create-designation";
import { useDeleteDesignation } from "../hooks/use-delete-designation";
import { useUpdateDesignation } from "../hooks/use-update-designation";
import {
  designationChecklistHref,
  DESIGNATION_LIST,
} from "../lib/designation-navigation";
import type { Designation } from "../types/designation";
import type { DesignationFormValues } from "../validation/designation-schema";

interface DesignationEditorProps {
  mode: "create" | "edit";
  designation?: Designation | null;
  returnTo: string;
  canManage: boolean;
}

export function DesignationEditor({
  mode,
  designation = null,
  returnTo,
  canManage,
}: DesignationEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateDesignation({ suppressToast: true });
  const updateMutation = useUpdateDesignation({ suppressToast: true });
  const deleteMutation = useDeleteDesignation();

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Designation"
          : designation
            ? `${designation.designationCode} ${designation.designationName}`
            : "Edit Designation",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: DesignationFormValues) => {
    setValidationErrors([]);

    if (mode === "edit" && designation) {
      updateMutation.mutate(
        { id: designation.id, data, existing: designation },
        {
          onSuccess: (result) => {
            const templateId =
              result.designation.onboardingTemplateId ??
              result.designation.onboardingTemplate?.id;

            if (result.linkedCount > 0 && templateId) {
              toast.success("Designation updated.", {
                action: {
                  label: "Open checklist",
                  onClick: () => {
                    router.push(designationChecklistHref(templateId));
                  },
                },
              });
            } else if (result.linkedCount > 0 || result.removedCount > 0) {
              toast.success(
                `Designation updated (${result.linkedCount} department(s) added, ${result.removedCount} removed).`,
              );
            } else {
              toast.success("Designation updated successfully.");
            }

            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update Designation."),
            );
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: (result) => {
        const templateId =
          result.designation.onboardingTemplateId ??
          result.designation.onboardingTemplate?.id ??
          null;

        if (result.linkedCount > 0 && templateId) {
          toast.success(
            `Designation created and linked to ${result.linkedCount} onboarding department(s).`,
            {
              action: {
                label: "Open checklist",
                onClick: () => {
                  router.push(designationChecklistHref(templateId));
                },
              },
            },
          );
        } else {
          toast.success("Designation created successfully.");
        }

        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Designation."));
      },
    });
  };

  const checklistId =
    designation?.onboardingTemplateId ?? designation?.onboardingTemplate?.id;

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Designation"
            : `Edit ${designation?.designationName ?? "Designation"}`
        }
        description={
          mode === "create"
            ? "Create a designation and optionally link onboarding involvement departments for one Branch."
            : "Update designation details and onboarding involvement. Department changes save in one step — nothing is left half-linked."
        }
        formId="designation-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(designation)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
        headerActions={
          checklistId ? (
            <Button type="button" variant="outline" asChild>
              <Link href={designationChecklistHref(checklistId)}>
                Open checklist
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <DesignationForm
            designation={designation}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={(messages) => {
              setValidationErrors(messages);
            }}
          />
        </div>
      </EntityFormPage>

      {designation ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Designation"
          name={designation.designationName}
          code={designation.designationCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(designation.id, {
              onSuccess: () => {
                router.push(DESIGNATION_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
